import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

// Initialize Firebase Admin if Service Account is provided
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log("Firebase Admin initialized successfully.");
    }
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON. Firebase Admin not initialized.");
  }
} else {
  console.log("FIREBASE_SERVICE_ACCOUNT not found in environment. Telegram bot direct approvals disabled.");
}

// Telegram Setup
const botToken = process.env.TELEGRAM_BOT_TOKEN || "8921472886:AAFcmsM2xVoWlHMYYDrjX58r4DMY6tRMymc";
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "8407449803";

// Delete existing webhook to use polling
if (botToken) {
  fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`)
    .then(() => console.log("Webhook deleted, starting polling..."))
    .catch(e => console.error("Error deleting webhook:", e));
}

// ---------- Telegram Helper ----------
async function tgSend(method: string, body: object) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function sendMessage(chatId: string | number, text: string, extra: object = {}) {
  return tgSend('sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', ...extra });
}

async function sendPhoto(chatId: string | number, photo: string, caption: string, extra: object = {}) {
  return tgSend('sendPhoto', { chat_id: chatId, photo, caption, parse_mode: 'Markdown', ...extra });
}

// ---------- In-memory API key store (runtime override, cleared on restart) ----------
let runtimeGeminiKey = process.env.GEMINI_API_KEY || "";

// ---------- Menu Builders ----------
function buildMainMenuMarkup() {
  return {
    inline_keyboard: [
      // Row 1 — Dashboard
      [
        { text: "📊 Thống kê", callback_data: "cmd_stats" },
        { text: "💳 GD chờ duyệt", callback_data: "cmd_pending" }
      ],
      // Row 2 — User management
      [
        { text: "🔍 Tìm người dùng", callback_data: "cmd_prompt_find" },
        { text: "👥 Danh sách NSD", callback_data: "cmd_prompt_listusers" }
      ],
      // Row 3 — Rewards
      [
        { text: "💰 Tặng Coin", callback_data: "cmd_prompt_addcoin" },
        { text: "📦 Cấp Gói", callback_data: "cmd_prompt_setpkg" }
      ],
      // Row 4 — Content
      [
        { text: "🏆 Cuộc thi & Bài nộp", callback_data: "cmd_competitions" },
        { text: "📝 Bài viết cộng đồng", callback_data: "cmd_posts" }
      ],
      // Row 5 — Broadcast
      [
        { text: "📢 Broadcast tất cả NSD", callback_data: "cmd_prompt_broadcast" }
      ],
      // Row 6 — System config
      [
        { text: "⚙️ Cấu hình API Key", callback_data: "cmd_apikeys" }
      ]
    ]
  };
}

function buildApiKeyMenuMarkup() {
  return {
    inline_keyboard: [
      [{ text: "🔑 Xem trạng thái API Keys", callback_data: "cmd_apikey_status" }],
      [{ text: "✏️ Đổi Gemini API Key", callback_data: "cmd_prompt_set_gemini" }],
      [{ text: "✏️ Đổi Telegram Bot Token", callback_data: "cmd_prompt_set_bottoken" }],
      [{ text: "✏️ Đổi Telegram Chat ID", callback_data: "cmd_prompt_set_chatid" }],
      [{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]
    ]
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // ---------- AI Route ----------
  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, type, apiKey: userApiKey } = req.body;
      const apiKey = userApiKey || runtimeGeminiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not set" });
      }

      const ai = new GoogleGenAI({ apiKey });
      let systemPrompt = "";

      if (type === "lesson_plan") {
        systemPrompt = `Bạn là một chuyên gia sư phạm hàng đầu, am hiểu sâu sắc Chương trình Giáo dục phổ thông mới và các thông tư hướng dẫn của Bộ Giáo dục và Đào tạo Việt Nam (đặc biệt là Công văn 5512).
Hãy soạn một Giáo án (Kế hoạch bài dạy) cực kỳ chi tiết, khoa học, có tính sư phạm cao dựa trên các tham số đầu vào. Giáo án bắt buộc phải tuân thủ cấu trúc chuẩn sư phạm sau đây:

1. KHÁI QUÁT CHUNG:
   - Môn học, Khối lớp, Tiết học.
   - Thời lượng thực hiện (Số tiết).
   - Tên bài học.

2. MỤC TIÊU BÀI HỌC (Đo lường được, chuẩn phát triển năng lực và phẩm chất):
   - Về Kiến thức: Nêu rõ các kiến thức cốt lõi học sinh sẽ đạt được.
   - Về Năng lực:
     * Năng lực chung (Tự chủ tự học, giao tiếp hợp tác, giải quyết vấn đề sáng tạo).
     * Năng lực đặc thù của môn học (Ví dụ: Năng lực tư duy toán học, năng lực ngôn ngữ, năng lực thực nghiệm...).
   - Về Phẩm chất: Các phẩm chất được bồi dưỡng qua bài học (Yêu nước, nhân ái, chăm chỉ, trung thực, trách nhiệm).

3. THIẾT BỊ DẠY HỌC VÀ HỌC LIỆU:
   - Chuẩn bị của Giáo viên (Thiết bị, máy chiếu, tranh ảnh, phiếu học tập, mẫu vật...).
   - Chuẩn bị của Học sinh (Sách giáo khoa, vở ghi, dụng cụ học tập riêng...).

4. TIẾN TRÌNH DẠY HỌC (Trình bày cực kỳ chi tiết từng hoạt động. Mỗi hoạt động bắt buộc phải mô tả đủ 4 bước sư phạm: Chuyển giao nhiệm vụ -> Thực hiện nhiệm vụ -> Báo cáo, thảo luận -> Kết luận, nhận định):
   - Hoạt động 1: Khởi động (Xác định vấn đề/Nhiệm vụ học tập) (Thời lượng, mục tiêu, cách thức tiến hành, sản phẩm mong đợi).
   - Hoạt động 2: Hình thành kiến thức mới (Giải quyết vấn đề) (Thời lượng, chia nhỏ từng đề mục kiến thức cốt lõi, tiến hành các hoạt động thảo luận/thực hành tương ứng).
   - Hoạt động 3: Luyện tập (Hệ thống câu hỏi, bài tập thực hành áp dụng trực tiếp kiến thức vừa học).
   - Hoạt động 4: Vận dụng (Giao nhiệm vụ mở rộng, liên hệ thực tế, tìm tòi sáng tạo ngoài giờ học).

5. PHỤ LỤC & ĐÁNH GIÁ:
   - Nội dung phiếu học tập (nếu có).
   - Tiêu chí đánh giá hoặc bảng Rubric chấm điểm hoạt động nhóm/cá nhân.

Hãy trình bày bằng Markdown thật đẹp mắt, sử dụng bảng biểu, danh sách có thứ tự, chữ in đậm và các khối trích dẫn để làm nổi bật thông tin trọng tâm.`;
      } else if (type === "plan") {
        systemPrompt = `Bạn là một chuyên gia quản lý giáo dục và điều hành nhà trường.
Hãy lập một Kế hoạch công tác/Kế hoạch hoạt động ngoại khóa/Kế hoạch bồi dưỡng chi tiết, chuyên nghiệp và thực tiễn dựa trên yêu cầu của người dùng. Bản kế hoạch phải có đầy đủ các cấu phần sau:

1. MỤC ĐÍCH & YÊU CẦU:
   - Mục đích thiết thực của hoạt động.
   - Các yêu cầu cần đạt đối với cán bộ, giáo viên, học sinh tham gia.

2. THÔNG TIN CHUNG:
   - Đối tượng tham gia (Lớp, khối, toàn trường).
   - Thời gian và Địa điểm thực hiện rõ ràng.

3. NỘI DUNG VÀ TIẾN TRÌNH CHI TIẾT:
   - Lịch trình cụ thể theo mốc thời gian (ví dụ: Buổi sáng, buổi chiều, hoặc từng tuần).
   - Các hoạt động cụ thể diễn ra trong chương trình.

4. PHÂN CÔNG NHIỆM VỤ & BAN TỔ CHỨC:
   - Danh sách phân công công việc cụ thể cho từng vị trí (Trưởng ban, Phó ban, Giáo viên chủ nhiệm, Đoàn thanh niên, các tổ bộ môn...).

5. CƠ SỞ VẬT CHẤT & DỰ TRÙ KINH PHÍ:
   - Danh mục trang thiết bị, vật tư cần chuẩn bị.
   - Bảng dự toán kinh phí chi tiết (Chi phí thuê xe, ăn uống, quà tặng, in ấn...).

6. BIỆN PHÁP AN TOÀN & PHƯƠNG ÁN DỰ PHÒNG:
   - Các rủi ro có thể xảy ra (thời tiết, sức khỏe, giao thông) và cách xử lý.

Trình bày chuyên nghiệp bằng Markdown với cấu trúc rõ ràng, sử dụng bảng biểu cho phần tiến trình và dự toán kinh phí để dễ quản lý.`;
      } else if (type === "digital") {
        systemPrompt = `Bạn là một chuyên gia tư vấn Chuyển đổi số cấp cao trong ngành Giáo dục, am hiểu sâu sắc xu hướng công nghệ dạy học hiện đại, các quyết định chính phủ và chỉ thị của Bộ Giáo dục & Đào tạo Việt Nam về chuyển đổi số giáo dục (như Đề án 131).
Hãy xây dựng một Đề xuất/Bản Kế hoạch Chuyển đổi số giáo dục cực kỳ chi tiết, thực tế, mang tính khả thi cao dựa trên yêu cầu. Kế hoạch phải bao quát các phương diện chiến lược sau:

1. ĐẶT VẤN ĐỀ & BỐI CẢNH:
   - Sự cần thiết phải chuyển đổi số tại đơn vị.
   - Thách thức và cơ hội thời đại số đối với dạy và học.

2. PHÂN TÍCH HIỆN TRẠNG (Đánh giá mức độ sẵn sàng):
   - Đánh giá về hạ tầng kỹ thuật (mạng internet, thiết bị đầu cuối).
   - Đánh giá năng lực số của đội ngũ Giáo viên & Cán bộ quản lý.
   - Khó khăn cốt lõi cần giải quyết lập tức.

3. MỤC TIÊU CHIẾN LƯỢC (Đo lường được, có mốc thời gian):
   - Mục tiêu ngắn hạn (1 năm đầu).
   - Mục tiêu trung và dài hạn (3 - 5 năm).

4. NHIỆM VỤ VÀ GIẢI PHÁP TRỌNG TÂM:
   - Số hóa quản lý và vận hành (Phần mềm quản lý trường học, sổ điểm điện tử, tuyển sinh số).
   - Đổi mới phương pháp dạy - học và đánh giá (Ứng dụng LMS, thiết kế bài giảng E-learning tương tác, xây dựng kho học liệu số, phòng Lab ảo).
   - Phát triển năng lực số đội ngũ nhân sự (Kế hoạch tập huấn định kỳ, khuyến khích sáng tạo số).
   - Đầu tư hạ tầng, công nghệ & Bảo mật thông tin (Lớp học thông minh, mạng nội bộ, sao lưu và bảo mật dữ liệu học sinh).

5. LỘ TRÌNH TRIỂN KHAI CHI TIẾT:
   - Phân chia lộ trình hành động chi tiết theo các giai đoạn rõ ràng (Giai đoạn chuẩn bị, Giai đoạn thí điểm, Giai đoạn nhân rộng).

6. DỰ TOÁN KINH PHÍ & KHÁI TOÁN ĐẦU TƯ:
   - Bảng dự toán kinh phí cơ bản cho các cấu phần (Phần mềm, hạ tầng phần cứng, tập huấn đào tạo, bảo trì vận hành).

7. ĐÁNH GIÁ RỦI RO & BIỆN PHÁP DỰ PHÒNG.

Hãy trình bày bằng Markdown chuyên nghiệp, sử dụng phân cấp đề mục rõ ràng, bảng biểu chi tiết, viết súc tích và có tính định hướng thực thi cao nhất.`;
      } else if (type === "infographic") {
        systemPrompt = `Bạn là một nhà thiết kế infographic giáo dục tài năng. Hãy phân tích tài liệu và chủ đề người dùng cung cấp, sau đó tóm tắt và trích xuất thành dữ liệu infographic trực quan cực kỳ chi tiết, sống động và chuyên nghiệp.
Hãy trả về một đối tượng JSON hợp lệ duy nhất, KHÔNG ĐƯỢC CHỨA DẤU NHÁY BA (triple backticks) hay bất kỳ văn bản nào khác ngoài JSON. Đối tượng JSON bắt buộc phải tuân thủ chính xác cấu trúc sau:
{
  "title": "Tiêu đề chính ngắn gọn, tác động mạnh (Ví dụ: Bí mật của Hệ Mặt Trời)",
  "subtitle": "Phụ đề hấp dẫn (Ví dụ: Hành trình khám phá Vũ trụ lớp 6)",
  "summaryText": "Một đoạn tóm tắt ngắn gọn, lôi cuốn, cung cấp cái nhìn tổng quan về chủ đề bài học.",
  "keyStats": [
    { "label": "Thống kê/Con số 1", "value": "Giá trị số (Ví dụ: 8 hành tinh)" },
    { "label": "Thống kê/Con số 2", "value": "Giá trị số (Ví dụ: 4.6 tỷ năm tuổi)" },
    { "label": "Thống kê/Con số 3", "value": "Giá trị số (Ví dụ: 150 triệu km)" }
  ],
  "roadmap": ["Ý chính/Mốc quan trọng 1", "Ý chính/Mốc quan trọng 2", "Ý chính/Mốc quan trọng 3", "Ý chính/Mốc quan trọng 4", "Ý chính/Mốc quan trọng 5"],
  "learnings": ["Mục tiêu/Ghi nhớ cốt lõi 1", "Mục tiêu/Ghi nhớ cốt lõi 2", "Mục tiêu/Ghi nhớ cốt lõi 3"],
  "details": [
    { "title": "Tiểu chủ đề 1", "content": "Nội dung kiến thức tóm tắt ngắn gọn, xúc tích, có cấu trúc." },
    { "title": "Tiểu chủ đề 2", "content": "Nội dung kiến thức tóm tắt ngắn gọn, xúc tích, có cấu trúc." },
    { "title": "Tiểu chủ đề 3", "content": "Nội dung kiến thức tóm tắt ngắn gọn, xúc tích, có cấu trúc." },
    { "title": "Tiểu chủ đề 4", "content": "Nội dung kiến thức tóm tắt ngắn gọn, xúc tích, có cấu trúc." }
  ],
  "authenticityNote": "Ghi chú nguồn dữ liệu hoặc thông tin khoa học kiểm chứng (Ví dụ: Dữ liệu NASA & SGK Khoa học tự nhiên 6)",
  "caution": "Lưu ý đặc biệt, sai lầm thường gặp hoặc cảnh báo quan trọng đối với học sinh"
}`;
      } else {
        systemPrompt = "Bạn là trợ lý AI cho giáo viên.";
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `${systemPrompt}\n\nYêu cầu: ${prompt}`,
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate content" });
    }
  });

  // ---------- Telegram: Payment Notification ----------
  app.post("/api/telegram/payment", async (req, res) => {
    try {
      const { userEmail, userName, packageLabel, price, imageUrl, transactionId } = req.body;

      if (!botToken || !ADMIN_CHAT_ID) {
        return res.status(500).json({ error: "Telegram configuration is missing in .env" });
      }

      const message = `🔔 *Yêu cầu thanh toán mới*\n\n` +
                      `👤 Người dùng: ${userName} (${userEmail})\n` +
                      `📦 Gói: ${packageLabel}\n` +
                      `💰 Số tiền: ${price}\n` +
                      `🔖 Mã GD: \`${transactionId}\`\n\n` +
                      `Vui lòng xử lý bên dưới hoặc vào trang quản trị.`;

      const replyMarkup = {
        inline_keyboard: [[
          { text: "✅ Duyệt ngay", callback_data: `approve_tx_${transactionId}` },
          { text: "❌ Từ chối", callback_data: `reject_tx_${transactionId}` }
        ]]
      };

      if (imageUrl && imageUrl.startsWith("http")) {
        await sendPhoto(ADMIN_CHAT_ID, imageUrl, message, { reply_markup: replyMarkup });
      } else {
        await sendMessage(ADMIN_CHAT_ID, message, { reply_markup: replyMarkup });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Telegram API Error:", error);
      res.status(500).json({ error: error.message || "Failed to notify Telegram" });
    }
  });

  // ---------- Telegram: New User Registration ----------
  app.post("/api/telegram/new-user", async (req, res) => {
    try {
      const { userName, userEmail, userId } = req.body;
      if (!botToken || !ADMIN_CHAT_ID) return res.status(500).json({ error: "Telegram not configured" });

      const msg = `🎉 *Người dùng mới đăng ký!*\n\n` +
                  `👤 *Tên:* ${userName || 'Chưa cập nhật'}\n` +
                  `📧 *Email:* ${userEmail}\n` +
                  `🔑 *UID:* \`${userId}\`\n` +
                  `🕐 *Thời gian:* ${new Date().toLocaleString('vi-VN')}`;

      await sendMessage(ADMIN_CHAT_ID, msg, {
        reply_markup: {
          inline_keyboard: [[
            { text: "🎁 Tặng Coin Chào mừng", callback_data: `welcome_coin_${userId}` },
            { text: "🔍 Xem hồ sơ", callback_data: `view_user_${userId}` }
          ]]
        }
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ---------- Telegram: New Community Post ----------
  app.post("/api/telegram/new-post", async (req, res) => {
    try {
      const { userName, userEmail, postId, content, imageUrl } = req.body;
      if (!botToken || !ADMIN_CHAT_ID) return res.status(500).json({ error: "Telegram not configured" });

      const preview = (content || '').slice(0, 200) + ((content || '').length > 200 ? '...' : '');
      const msg = `📝 *Bài viết cộng đồng mới*\n\n` +
                  `👤 *Tác giả:* ${userName} (${userEmail})\n` +
                  `💬 *Nội dung:* ${preview}\n` +
                  `🔖 *Post ID:* \`${postId}\`\n` +
                  `🕐 *Thời gian:* ${new Date().toLocaleString('vi-VN')}`;

      const markup = {
        inline_keyboard: [[
          { text: "🗑 Xóa bài viết", callback_data: `delete_post_${postId}` },
          { text: "✅ Bỏ qua", callback_data: "noop" }
        ]]
      };

      if (imageUrl && imageUrl.startsWith("http")) {
        await sendPhoto(ADMIN_CHAT_ID, imageUrl, msg, { reply_markup: markup });
      } else {
        await sendMessage(ADMIN_CHAT_ID, msg, { reply_markup: markup });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ---------- Telegram: New Competition Submission ----------
  app.post("/api/telegram/new-submission", async (req, res) => {
    try {
      const { userName, userEmail, competitionTitle, resourceTitle, submissionId } = req.body;
      if (!botToken || !ADMIN_CHAT_ID) return res.status(500).json({ error: "Telegram not configured" });

      const msg = `🏆 *Bài dự thi mới được nộp!*\n\n` +
                  `👤 *Giáo viên:* ${userName} (${userEmail})\n` +
                  `🥇 *Cuộc thi:* ${competitionTitle}\n` +
                  `📄 *Tài liệu:* ${resourceTitle}\n` +
                  `🔖 *ID Bài nộp:* \`${submissionId}\`\n` +
                  `🕐 *Thời gian:* ${new Date().toLocaleString('vi-VN')}`;

      await sendMessage(ADMIN_CHAT_ID, msg, {
        reply_markup: {
          inline_keyboard: [[
            { text: "📊 Xem tất cả bài nộp", callback_data: "cmd_competitions" },
            { text: "✅ OK", callback_data: "noop" }
          ]]
        }
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ---------- Telegram: Grade Notification to Admin ----------
  app.post("/api/telegram/grade-done", async (req, res) => {
    try {
      const { adminName, userName, userEmail, resourceTitle, grade, competitionTitle } = req.body;
      if (!botToken || !ADMIN_CHAT_ID) return res.status(500).json({ error: "Telegram not configured" });

      const msg = `✅ *Đã chấm điểm bài dự thi*\n\n` +
                  `📊 *Kết quả:* Loại *${grade}*\n` +
                  `👤 *Giáo viên:* ${userName} (${userEmail})\n` +
                  `📄 *Tài liệu:* ${resourceTitle}\n` +
                  `🥇 *Cuộc thi:* ${competitionTitle}\n` +
                  `🕐 *Thời gian:* ${new Date().toLocaleString('vi-VN')}`;

      await sendMessage(ADMIN_CHAT_ID, msg);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ---------- Telegram Polling loop ----------
  if (botToken) {
    let offset = 0;

    const processUpdate = async (update: any) => {
      if (!getApps().length) {
        console.warn("Firebase Admin not initialized, cannot process Telegram update.");
        return;
      }

      const db = getFirestore();

      const sendMainMenu = async (chatId: string | number) => {
        const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const geminiStatus = (runtimeGeminiKey || process.env.GEMINI_API_KEY) ? '🟢 Hoạt động' : '🔴 Chưa cấu hình';
        await sendMessage(chatId,
          `╔══════════════════════╗\n` +
          `║  🎓 *EDUCREATE ADMIN*  ║\n` +
          `╚══════════════════════╝\n\n` +
          `🤖 *Bảng điều khiển quản trị*\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🕐 ${now}\n` +
          `🔮 Gemini AI: ${geminiStatus}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `Chọn chức năng bên dưới 👇`,
          { reply_markup: buildMainMenuMarkup() }
        );
      };

      // ---- Callback Queries (Button Clicks) ----
      if (update.callback_query) {
        const query = update.callback_query;
        const data = query.data;
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;

        if (chatId.toString() !== ADMIN_CHAT_ID.toString()) return;

        // Answer callback immediately
        tgSend('answerCallbackQuery', { callback_query_id: query.id }).catch(() => {});

        // --- No-op ---
        if (data === 'noop') return;

        // --- Main menu navigation ---
        if (data === 'cmd_menu') {
          await sendMainMenu(chatId);
          return;
        }

        // --- Stats ---
        if (data === 'cmd_stats') {
          try {
            const [usersSnap, txSnap, txAllSnap, postsSnap, subsSnap, subsGradedSnap] = await Promise.all([
              db.collection('users').get(),
              db.collection('transactions').where('status', '==', 'pending').get(),
              db.collection('transactions').get(),
              db.collection('posts').get(),
              db.collection('submissions').get(),
              db.collection('submissions').where('status', '==', 'Đã chấm điểm').get()
            ]);

            const allUsers = usersSnap.docs.map(d => d.data());
            const proUsers = allUsers.filter(u => u.package === 'pro').length;
            const enterpriseUsers = allUsers.filter(u => u.package === 'enterprise').length;
            const adminUsers = allUsers.filter(u => u.package === 'admin').length;
            const freeUsers = allUsers.filter(u => !u.package || u.package === 'free').length;
            const approvedTx = txAllSnap.docs.filter(d => d.data().status === 'approved').length;

            const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
            const msg =
              `📊 *THỐNG KÊ TỔNG QUAN*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `👥 *Người dùng:* ${usersSnap.size} tài khoản\n` +
              `   ├ 🆓 Free: *${freeUsers}*\n` +
              `   ├ ⚡ Pro: *${proUsers}*\n` +
              `   ├ 🏢 Enterprise: *${enterpriseUsers}*\n` +
              `   └ 🛡 Admin: *${adminUsers}*\n\n` +
              `💳 *Giao dịch:*\n` +
              `   ├ ⏳ Chờ duyệt: *${txSnap.size}*\n` +
              `   └ ✅ Đã duyệt: *${approvedTx}*\n\n` +
              `🌐 *Cộng đồng:*\n` +
              `   └ 📝 Bài viết: *${postsSnap.size}*\n\n` +
              `🏆 *Cuộc thi:*\n` +
              `   ├ 📥 Tổng bài nộp: *${subsSnap.size}*\n` +
              `   └ ✅ Đã chấm: *${subsGradedSnap.size}*\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🕐 _${now}_`;

            await sendMessage(chatId, msg, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "💳 Xem GD chờ duyệt", callback_data: "cmd_pending" }],
                  [{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]
                ]
              }
            });
          } catch (e: any) {
            await sendMessage(chatId, `❌ Lỗi lấy thống kê: ${e.message}`);
          }
          return;
        }

        // --- Pending transactions ---
        if (data === 'cmd_pending') {
          const q = await db.collection('transactions').where('status', '==', 'pending').orderBy('createdAt', 'desc').limit(5).get();
          if (q.empty) {
            await sendMessage(chatId,
              `💳 *GIAO DỊCH CHỜ DUYỆT*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `✅ Không có giao dịch nào đang chờ xử lý.\n\n` +
              `_Hệ thống sẽ thông báo ngay khi có giao dịch mới._`,
              { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } });
          } else {
            await sendMessage(chatId,
              `💳 *GIAO DỊCH CHỜ DUYỆT* (${q.size} giao dịch)\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `_Hiển thị 5 giao dịch mới nhất — chọn Duyệt / Từ chối bên dưới mỗi GD:_`
            );
            for (const docRef of q.docs) {
              const tx = docRef.data();
              const typeLabel = tx.type === 'deposit' ? '💰 Nạp Coin' : '📦 Nâng cấp Gói';
              const detailStr = tx.type === 'deposit'
                ? `💵 *Số tiền:* ${Number(tx.amount || 0).toLocaleString()} Coin`
                : `📦 *Gói:* ${tx.packageLabel || tx.packageKey || 'Pro'} — ${Number(tx.amount || 0).toLocaleString()}đ`;
              const createdStr = tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString('vi-VN') : '—';
              const msg =
                `${typeLabel}\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `👤 *${tx.userName || 'Không rõ'}*\n` +
                `📧 ${tx.userEmail || '—'}\n` +
                `${detailStr}\n` +
                `🕐 ${createdStr}\n` +
                `🔖 \`${docRef.id}\``;
              const markup = {
                inline_keyboard: [[
                  { text: "✅ Duyệt", callback_data: `approve_tx_${docRef.id}` },
                  { text: "❌ Từ chối", callback_data: `reject_tx_${docRef.id}` }
                ]]
              };
              if (tx.imageUrl && tx.imageUrl.startsWith("http")) {
                await sendPhoto(chatId, tx.imageUrl, msg, { reply_markup: markup });
              } else {
                await sendMessage(chatId, msg, { reply_markup: markup });
              }
            }
            await sendMessage(chatId, `_Đã hiển thị xong ${q.size} giao dịch._`,
              { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } });
          }
          return;
        }

        // --- Competitions & Submissions ---
        if (data === 'cmd_competitions') {
          const subsSnap = await db.collection('submissions').orderBy('submittedAt', 'desc').limit(5).get();
          if (subsSnap.empty) {
            await sendMessage(chatId,
              `🏆 *CUỘC THI & BÀI DỰ THI*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `📭 Chưa có bài dự thi nào được nộp.`,
              { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } });
          } else {
            await sendMessage(chatId,
              `🏆 *CUỘC THI & BÀI DỰ THI*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `_5 bài dự thi mới nhất:_`
            );
            for (const d of subsSnap.docs) {
              const sub = d.data();
              const statusEmoji = sub.status === 'Đã chấm điểm' ? '✅' : '⏳';
              const gradeStr = sub.grade ? `\n🏅 *Điểm:* Loại *${sub.grade}*` : '';
              const submittedAt = sub.submittedAt?.toDate ? sub.submittedAt.toDate().toLocaleDateString('vi-VN') : '—';
              const msg =
                `${statusEmoji} *${sub.status}*\n` +
                `━━━━━━━━━━━━\n` +
                `👤 *${sub.userName}*\n` +
                `📧 ${sub.userEmail}\n` +
                `📄 *TL:* ${sub.resourceTitle}\n` +
                `🥇 ${sub.competitionTitle}\n` +
                `🕐 ${submittedAt}${gradeStr}`;
              await sendMessage(chatId, msg);
            }
            await sendMessage(chatId, `_Để chấm điểm chi tiết, truy cập trang Quản trị._`,
              { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } });
          }
          return;
        }

        // --- Community posts ---
        if (data === 'cmd_posts') {
          const postsSnap = await db.collection('posts').orderBy('createdAt', 'desc').limit(5).get();
          if (postsSnap.empty) {
            await sendMessage(chatId,
              `📝 *BÀI VIẾT CỘNG ĐỒNG*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `📭 Chưa có bài viết nào.`,
              { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } });
          } else {
            await sendMessage(chatId,
              `📝 *BÀI VIẾT CỘNG ĐỒNG*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n` +
              `_5 bài viết mới nhất — nhấn 🗑 để xóa:_`
            );
            for (const d of postsSnap.docs) {
              const post = d.data();
              const preview = (post.content || '').slice(0, 120);
              const likesCount = (post.likes || []).length + (post.loves || []).length;
              const createdAt = post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString('vi-VN') : '—';
              const msg =
                `👤 *${post.userName}*\n` +
                `🕐 ${createdAt} · ❤️ ${likesCount}\n` +
                `💬 ${preview}${(post.content || '').length > 120 ? '...' : ''}\n` +
                `🔖 \`${d.id}\``;
              await sendMessage(chatId, msg, {
                reply_markup: {
                  inline_keyboard: [[
                    { text: "🗑 Xóa bài viết", callback_data: `delete_post_${d.id}` },
                    { text: "✅ Bỏ qua", callback_data: "noop" }
                  ]]
                }
              });
            }
          }
          return;
        }

        // --- Force Reply prompts ---
        if (data === 'cmd_prompt_find') {
          await sendMessage(chatId,
            '🔍 *TÌM NGƯỜI DÙNG*\n\nVui lòng Reply (Trả lời) tin nhắn này kèm theo Email cần tìm:',
            { reply_markup: { force_reply: true, selective: true } }
          );
          return;
        }

        if (data === 'cmd_prompt_addcoin') {
          await sendMessage(chatId,
            '💰 *TẶNG COIN*\n\nVui lòng Reply (Trả lời) tin nhắn này theo cú pháp:\n`<Email> <Số_Coin>`\n\n_(Ví dụ: admin@gmail.com 50000)_',
            { reply_markup: { force_reply: true, selective: true } }
          );
          return;
        }

        if (data === 'cmd_prompt_setpkg') {
          await sendMessage(chatId,
            '📦 *CẤP GÓI TÀI KHOẢN*\n\nVui lòng Reply (Trả lời) tin nhắn này theo cú pháp:\n`<Email> <Tên_Gói>`\n\n_(Gói: pro / enterprise / free)_\n_(Ví dụ: admin@gmail.com pro)_',
            { reply_markup: { force_reply: true, selective: true } }
          );
          return;
        }

        if (data === 'cmd_prompt_listusers') {
          await sendMessage(chatId,
            '👥 *DANH SÁCH NGƯỜI DÙNG*\n\nVui lòng Reply (Trả lời) tin nhắn này và nhập gói muốn lọc:\n`<Gói>` hoặc `all`\n\n_(Ví dụ: pro, enterprise, free, all)_',
            { reply_markup: { force_reply: true, selective: true } }
          );
          return;
        }

        if (data === 'cmd_prompt_broadcast') {
          await sendMessage(chatId,
            '📢 *GỬI THÔNG BÁO BROADCAST*\n' +
            '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            'Vui lòng *Reply* (Trả lời) tin nhắn này với nội dung thông báo muốn gửi tới toàn bộ người dùng:\n\n' +
            '_Lưu ý: Thông báo sẽ xuất hiện trong mục thông báo của tất cả tài khoản._',
            { reply_markup: { force_reply: true, selective: true } }
          );
          return;
        }

        // --- API Key menu ---
        if (data === 'cmd_apikeys') {
          const geminiKey = runtimeGeminiKey || process.env.GEMINI_API_KEY || '';
          const botTok = process.env.TELEGRAM_BOT_TOKEN || botToken;
          const chatIdCfg = process.env.TELEGRAM_CHAT_ID || ADMIN_CHAT_ID;
          const maskKey = (k: string) => k ? `${k.slice(0, 6)}${'*'.repeat(Math.max(0, k.length - 10))}${k.slice(-4)}` : '❌ Chưa cấu hình';

          const msg =
            `⚙️ *CẤU HÌNH API KEY*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🤖 *Gemini AI Key:*\n` +
            `   \`${maskKey(geminiKey)}\`\n` +
            `   Status: ${geminiKey ? '🟢 Đã cấu hình' : '🔴 Chưa cấu hình'}\n\n` +
            `📱 *Telegram Bot Token:*\n` +
            `   \`${maskKey(botTok)}\`\n` +
            `   Status: ${botTok ? '🟢 Hoạt động' : '🔴 Chưa cấu hình'}\n\n` +
            `🆔 *Admin Chat ID:*\n` +
            `   \`${chatIdCfg}\`\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `_Chọn chức năng để thay đổi:_`;

          await sendMessage(chatId, msg, { reply_markup: buildApiKeyMenuMarkup() });
          return;
        }

        if (data === 'cmd_apikey_status') {
          const geminiKey = runtimeGeminiKey || process.env.GEMINI_API_KEY || '';
          // Test Gemini key
          let geminiTestResult = '⏳ Đang kiểm tra...';
          if (geminiKey) {
            try {
              const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
              geminiTestResult = testRes.ok ? '🟢 Key hợp lệ & hoạt động tốt' : `🔴 Key lỗi (HTTP ${testRes.status})`;
            } catch {
              geminiTestResult = '🔴 Không thể kết nối';
            }
          } else {
            geminiTestResult = '🔴 Chưa cấu hình';
          }

          // Test Telegram bot
          let tgTestResult = '⏳ Đang kiểm tra...';
          try {
            const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
            const tgData = await tgRes.json();
            tgTestResult = tgData.ok ? `🟢 Bot: @${tgData.result.username}` : '🔴 Token không hợp lệ';
          } catch {
            tgTestResult = '🔴 Không thể kết nối';
          }

          const msg =
            `🔍 *KIỂM TRA TRẠNG THÁI API*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `🤖 *Gemini AI:* ${geminiTestResult}\n\n` +
            `📱 *Telegram Bot:* ${tgTestResult}\n\n` +
            `🔥 *Firebase Admin:* ${getApps().length ? '🟢 Đã kết nối' : '🔴 Chưa kết nối'}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🕐 _${new Date().toLocaleString('vi-VN')}_`;

          await sendMessage(chatId, msg, {
            reply_markup: {
              inline_keyboard: [
                [{ text: "🔙 Quay lại API Keys", callback_data: "cmd_apikeys" }],
                [{ text: "🏠 Menu chính", callback_data: "cmd_menu" }]
              ]
            }
          });
          return;
        }

        if (data === 'cmd_prompt_set_gemini') {
          await sendMessage(chatId,
            '🔑 *ĐỔI GEMINI API KEY*\n' +
            '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            'Vui lòng *Reply* (Trả lời) tin nhắn này với Gemini API Key mới:\n\n' +
            '⚠️ _Key mới chỉ có hiệu lực trong phiên chạy hiện tại._\n' +
            '_Để lưu vĩnh viễn, hãy cập nhật biến môi trường `GEMINI_API_KEY`._',
            { reply_markup: { force_reply: true, selective: true } }
          );
          return;
        }

        if (data === 'cmd_prompt_set_bottoken') {
          await sendMessage(chatId,
            '📱 *ĐỔI TELEGRAM BOT TOKEN*\n' +
            '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '⚠️ *Lưu ý quan trọng:*\n' +
            'Bot Token chỉ có thể thay đổi vĩnh viễn trong file `.env`.\n\n' +
            'Biến cần cập nhật:\n`TELEGRAM_BOT_TOKEN=<token_mới>`\n\n' +
            '_Sau khi cập nhật .env, khởi động lại server để áp dụng._',
            { reply_markup: { inline_keyboard: [[{ text: "🔙 Quay lại", callback_data: "cmd_apikeys" }]] } }
          );
          return;
        }

        if (data === 'cmd_prompt_set_chatid') {
          await sendMessage(chatId,
            '🆔 *ĐỔI TELEGRAM CHAT ID*\n' +
            '━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '⚠️ *Lưu ý quan trọng:*\n' +
            'Chat ID chỉ có thể thay đổi vĩnh viễn trong file `.env`.\n\n' +
            'Biến cần cập nhật:\n`TELEGRAM_CHAT_ID=<chat_id_mới>`\n\n' +
            '_Chat ID của bạn là:_ `' + ADMIN_CHAT_ID + '`\n' +
            '_Nếu muốn lấy Chat ID mới, hãy nhắn /getid cho bot._',
            { reply_markup: { inline_keyboard: [[{ text: "🔙 Quay lại", callback_data: "cmd_apikeys" }]] } }
          );
          return;
        }

        // --- Approve Transaction ---
        if (data.startsWith('approve_tx_')) {
          const txId = data.replace('approve_tx_', '');
          const txRef = db.collection('transactions').doc(txId);
          const txDoc = await txRef.get();
          if (txDoc.exists) {
            const txData = txDoc.data()!;
            if (txData.status === 'pending') {
              await txRef.update({ status: 'approved', processedAt: FieldValue.serverTimestamp() });

              if (txData.type === 'deposit') {
                const amount = Number(txData.amount || 0);
                await db.collection('users').doc(txData.userId).set({ coins: FieldValue.increment(amount) }, { merge: true });
                await db.collection('notifications').add({
                  userId: txData.userId,
                  type: 'general',
                  title: 'Nạp Coin thành công!',
                  message: `Bạn đã được cộng ${amount.toLocaleString()} Coin vào tài khoản.`,
                  createdAt: FieldValue.serverTimestamp(),
                  read: false
                });
                await tgSend('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
                await sendMessage(chatId,
                  `✅ *DUYỆT THÀNH CÔNG*\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `👤 *Người dùng:* ${txData.userEmail}\n` +
                  `💰 *Đã cộng:* ${Number(txData.amount || 0).toLocaleString()} Coin\n` +
                  `🔖 *Mã GD:* \`${txId}\``
                );
              } else {
                const date = new Date();
                date.setDate(date.getDate() + Number(txData.days || 30));
                await db.collection('users').doc(txData.userId).set({
                  package: txData.packageKey || 'pro',
                  expiresAt: date.toISOString(),
                  usageCount: 0
                }, { merge: true });
                await db.collection('notifications').add({
                  userId: txData.userId,
                  type: 'system',
                  title: 'Giao dịch đã được duyệt!',
                  message: `Yêu cầu kích hoạt gói ${txData.packageLabel} của bạn đã được duyệt. Hạn sử dụng đến ngày ${date.toLocaleDateString('vi-VN')}.`,
                  createdAt: FieldValue.serverTimestamp(),
                  read: false
                });
                await tgSend('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
                await sendMessage(chatId,
                  `✅ *DUYỆT THÀNH CÔNG*\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `👤 *Người dùng:* ${txData.userEmail}\n` +
                  `📦 *Gói đã cấp:* ${(txData.packageKey || 'pro').toUpperCase()}\n` +
                  `⏳ *Hạn đến:* ${date.toLocaleDateString('vi-VN')}\n` +
                  `🔖 *Mã GD:* \`${txId}\``
                );
              }
            } else {
              await sendMessage(chatId, `⚠️ Giao dịch \`${txId}\` đã được xử lý trước đó (trạng thái: ${txData.status}).`);
            }
          }
          return;
        }

        // --- Reject Transaction ---
        if (data.startsWith('reject_tx_')) {
          const txId = data.replace('reject_tx_', '');
          const txRef = db.collection('transactions').doc(txId);
          await txRef.update({ status: 'rejected', processedAt: FieldValue.serverTimestamp() });
          const txDoc = await txRef.get();
          let userEmail = 'Không rõ';
          if (txDoc.exists) {
            const txData = txDoc.data()!;
            userEmail = txData.userEmail || 'Không rõ';
            await db.collection('notifications').add({
              userId: txData.userId,
              type: 'system',
              title: 'Giao dịch bị từ chối',
              message: `Giao dịch ${txData.type === 'deposit' ? 'nạp Coin' : 'kích hoạt gói'} của bạn đã bị từ chối. Vui lòng liên hệ quản trị viên.`,
              createdAt: FieldValue.serverTimestamp(),
              read: false
            });
          }
          await tgSend('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
          await sendMessage(chatId,
            `❌ *ĐÃ TỪ CHỐI GIAO DỊCH*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `👤 *Người dùng:* ${userEmail}\n` +
            `🔖 *Mã GD:* \`${txId}\`\n\n` +
            `_Đã gửi thông báo từ chối tới người dùng._`
          );
          return;
        }

        // --- Welcome coin for new user ---
        if (data.startsWith('welcome_coin_')) {
          const userId = data.replace('welcome_coin_', '');
          const welcomeCoins = 10000;
          await db.collection('users').doc(userId).set({ coins: FieldValue.increment(welcomeCoins) }, { merge: true });
          await db.collection('notifications').add({
            userId,
            type: 'general',
            title: 'Chào mừng bạn đến với EduCreate!',
            message: `Bạn nhận được ${welcomeCoins.toLocaleString()} Coin chào mừng từ Admin.`,
            createdAt: FieldValue.serverTimestamp(),
            read: false
          });
          await tgSend('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
          await sendMessage(chatId, `🎁 Đã tặng *${welcomeCoins.toLocaleString()} Coin* chào mừng thành công!`);
          return;
        }

        // --- View user by UID ---
        if (data.startsWith('view_user_')) {
          const userId = data.replace('view_user_', '');
          const userDoc = await db.collection('users').doc(userId).get();
          if (userDoc.exists) {
            const u = userDoc.data()!;
            const exp = u.expiresAt ? new Date(u.expiresAt).toLocaleDateString('vi-VN') : 'Không giới hạn';
            const pkgEmoji = u.package === 'enterprise' ? '🏢' : u.package === 'pro' ? '⚡' : u.package === 'admin' ? '🛡' : '🆓';
            const msg =
              `👤 *HỒ SƠ NGƯỜI DÙNG*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `📛 *Tên:* ${u.displayName || u.name || 'Chưa cập nhật'}\n` +
              `📧 *Email:* ${u.email || '—'}\n` +
              `📞 *SĐT:* ${u.phone || '—'}\n` +
              `🏫 *Đơn vị:* ${u.workplace || '—'}\n\n` +
              `${pkgEmoji} *Gói:* ${(u.package || 'FREE').toUpperCase()}\n` +
              `⏳ *Hạn sử dụng:* ${exp}\n` +
              `💰 *Coin:* ${Number(u.coins || 0).toLocaleString()}\n\n` +
              `🔑 *UID:* \`${userDoc.id}\``;
            await sendMessage(chatId, msg, {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "💰 Tặng Coin", callback_data: "cmd_prompt_addcoin" },
                    { text: "📦 Cấp Gói", callback_data: "cmd_prompt_setpkg" }
                  ],
                  [{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]
                ]
              }
            });
          } else {
            await sendMessage(chatId, `❌ Không tìm thấy người dùng với UID: \`${userId}\``);
          }
          return;
        }

        // --- Delete community post ---
        if (data.startsWith('delete_post_')) {
          const postId = data.replace('delete_post_', '');
          await db.collection('posts').doc(postId).delete();
          await tgSend('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
          await sendMessage(chatId, `🗑 Đã xóa bài viết \`${postId}\` thành công.`);
          return;
        }
      }

      // ---- Text Messages & Replies ----
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        if (chatId.toString() !== ADMIN_CHAT_ID.toString()) return;

        const text = update.message.text.trim();

        // Reply to ForceReply prompts
        if (update.message.reply_to_message?.text) {
          const prompt = update.message.reply_to_message.text;

          if (prompt.includes('TÌM NGƯỜI DÙNG')) {
            const email = text;
            const q = await db.collection('users').where('email', '==', email).get();
            if (q.empty) {
              await sendMessage(chatId,
                `❌ *Không tìm thấy người dùng!*\n\n` +
                `Email \`${email}\` không tồn tại trong hệ thống.\n` +
                `Vui lòng kiểm tra lại chính tả.`
              );
            } else {
              const docRef = q.docs[0];
              const u = docRef.data();
              const exp = u.expiresAt ? new Date(u.expiresAt).toLocaleDateString('vi-VN') : 'Không giới hạn';
              const pkgEmoji = u.package === 'enterprise' ? '🏢' : u.package === 'pro' ? '⚡' : u.package === 'admin' ? '🛡' : '🆓';
              const msg =
                `👤 *HỒ SƠ NGƯỜI DÙNG*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📛 *Tên:* ${u.displayName || u.name || 'Chưa cập nhật'}\n` +
                `📧 *Email:* ${u.email || '—'}\n` +
                `📞 *SĐT:* ${u.phone || '—'}\n` +
                `🏫 *Đơn vị:* ${u.workplace || '—'}\n\n` +
                `${pkgEmoji} *Gói:* ${(u.package || 'FREE').toUpperCase()}\n` +
                `⏳ *Hạn sử dụng:* ${exp}\n` +
                `💰 *Coin:* ${Number(u.coins || 0).toLocaleString()}\n\n` +
                `🔑 *UID:* \`${docRef.id}\``;
              await sendMessage(chatId, msg, {
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "💰 Tặng Coin", callback_data: "cmd_prompt_addcoin" },
                      { text: "📦 Cấp Gói", callback_data: "cmd_prompt_setpkg" }
                    ],
                    [{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]
                  ]
                }
              });
            }
            return;
          }

          if (prompt.includes('TẶNG COIN')) {
            const parts = text.split(/\s+/);
            const email = parts[0];
            const amount = parseInt(parts[1]);
            if (email && !isNaN(amount) && amount > 0) {
              const q = await db.collection('users').where('email', '==', email).get();
              if (!q.empty) {
                const ref = q.docs[0].ref;
                await db.runTransaction(async (t) => {
                  const doc = await t.get(ref);
                  const current = (doc.data() as any).coins || 0;
                  t.update(ref, { coins: current + amount });
                });
                await db.collection('notifications').add({
                  userId: q.docs[0].id,
                  type: 'general',
                  title: 'Bạn được Admin tặng Coin!',
                  message: `Admin đã tặng thêm ${amount.toLocaleString()} Coin vào tài khoản của bạn.`,
                  createdAt: FieldValue.serverTimestamp(),
                  read: false
                });
                await sendMessage(chatId,
                  `✅ *TẶNG COIN THÀNH CÔNG*\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `💰 *Đã cộng:* ${amount.toLocaleString()} Coin\n` +
                  `👤 *Tài khoản:* \`${email}\`\n\n` +
                  `_Người dùng đã nhận được thông báo._`,
                  { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } }
                );
              } else {
                await sendMessage(chatId, `❌ *Không tìm thấy người dùng!*\nEmail \`${email}\` không tồn tại trong hệ thống.`);
              }
            } else {
              await sendMessage(chatId,
                `❌ *Cú pháp không hợp lệ!*\n\n` +
                `Đúng cú pháp:\n\`<Email> <Số_Coin>\`\n\n` +
                `Ví dụ: \`giaovien@school.edu.vn 50000\``
              );
            }
            return;
          }

          if (prompt.includes('CẤP GÓI')) {
            const parts = text.split(/\s+/);
            const email = parts[0];
            const pkg = parts[1]?.toLowerCase();
            if (email && ['pro', 'enterprise', 'free'].includes(pkg)) {
              const q = await db.collection('users').where('email', '==', email).get();
              if (!q.empty) {
                const validity = pkg === 'pro' ? 30 : pkg === 'enterprise' ? 365 : 0;
                const newExp = new Date(Date.now() + validity * 24 * 60 * 60 * 1000);
                await q.docs[0].ref.update({ package: pkg, expiresAt: newExp.toISOString() });
                const pkgEmoji = pkg === 'enterprise' ? '🏢' : pkg === 'pro' ? '⚡' : '🆓';
                await db.collection('notifications').add({
                  userId: q.docs[0].id,
                  type: 'system',
                  title: 'Gói tài khoản đã được cập nhật!',
                  message: `Admin đã cấp gói ${pkg.toUpperCase()} cho tài khoản của bạn. Hạn sử dụng đến ${newExp.toLocaleDateString('vi-VN')}.`,
                  createdAt: FieldValue.serverTimestamp(),
                  read: false
                });
                await sendMessage(chatId,
                  `✅ *CẤP GÓI THÀNH CÔNG*\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `${pkgEmoji} *Gói mới:* ${pkg.toUpperCase()}\n` +
                  `👤 *Tài khoản:* \`${email}\`\n` +
                  `⏳ *Hạn đến:* ${validity > 0 ? newExp.toLocaleDateString('vi-VN') : 'Không giới hạn'}\n\n` +
                  `_Người dùng đã nhận được thông báo._`,
                  { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } }
                );
              } else {
                await sendMessage(chatId, `❌ *Không tìm thấy người dùng!*\nEmail \`${email}\` không tồn tại.`);
              }
            } else {
              await sendMessage(chatId,
                `❌ *Cú pháp không hợp lệ!*\n\n` +
                `Đúng cú pháp:\n\`<Email> <pro|enterprise|free>\`\n\n` +
                `Ví dụ: \`giaovien@school.edu.vn pro\``
              );
            }
            return;
          }

          if (prompt.includes('DANH SÁCH NGƯỜI DÙNG')) {
            const filter = text.toLowerCase().trim();
            let q;
            if (filter === 'all') {
              q = await db.collection('users').limit(10).get();
            } else if (['pro', 'enterprise', 'free'].includes(filter)) {
              q = await db.collection('users').where('package', '==', filter).limit(10).get();
            } else {
              await sendMessage(chatId,
                `❌ *Bộ lọc không hợp lệ.*\n\n` +
                `Nhập một trong: \`pro\`, \`enterprise\`, \`free\`, \`all\``
              );
              return;
            }

            if (q.empty) {
              await sendMessage(chatId, `📭 Không có người dùng nào với gói *${filter.toUpperCase()}*.`);
            } else {
              const pkgLabel = filter === 'all' ? 'TẤT CẢ' : filter.toUpperCase();
              let list =
                `👥 *DANH SÁCH NGƯỜI DÙNG — ${pkgLabel}*\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `_Hiển thị tối đa 10 người:_\n\n`;
              q.docs.forEach((d, i) => {
                const u = d.data();
                const pkgEmoji = u.package === 'enterprise' ? '🏢' : u.package === 'pro' ? '⚡' : u.package === 'admin' ? '🛡' : '🆓';
                list += `${i + 1}. ${pkgEmoji} *${u.name || u.displayName || 'N/A'}*\n` +
                        `    📧 ${u.email}\n`;
              });
              list += `\n_Tổng: ${q.size} tài khoản_`;
              await sendMessage(chatId, list, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] }
              });
            }
            return;
          }

          if (prompt.includes('BROADCAST')) {
            const broadcastText = text;
            const allUsersSnap = await db.collection('users').get();
            const batch = db.batch();
            for (const userDoc of allUsersSnap.docs) {
              const notifRef = db.collection('notifications').doc();
              batch.set(notifRef, {
                userId: userDoc.id,
                type: 'general',
                title: '📢 Thông báo từ Admin',
                message: broadcastText,
                createdAt: FieldValue.serverTimestamp(),
                read: false
              });
            }
            await batch.commit();
            await sendMessage(chatId,
              `📢 *BROADCAST THÀNH CÔNG!*\n` +
              `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `✅ Đã gửi tới *${allUsersSnap.size} người dùng*\n\n` +
              `📝 *Nội dung đã gửi:*\n_${broadcastText}_`,
              { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } }
            );
            return;
          }

          if (prompt.includes('ĐỔI GEMINI API KEY')) {
            const newKey = text.trim();
            if (newKey.length < 20) {
              await sendMessage(chatId,
                `❌ *Key không hợp lệ!*\n\n` +
                `Gemini API Key thường có độ dài >= 30 ký tự.\n` +
                `Vui lòng kiểm tra lại key từ Google AI Studio.`
              );
              return;
            }
            // Test the new key before applying
            let testResult = '';
            try {
              const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${newKey}`);
              if (testRes.ok) {
                runtimeGeminiKey = newKey;
                const masked = `${newKey.slice(0, 6)}${'*'.repeat(newKey.length - 10)}${newKey.slice(-4)}`;
                await sendMessage(chatId,
                  `✅ *ĐỔI GEMINI KEY THÀNH CÔNG!*\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `🔑 *Key mới:* \`${masked}\`\n` +
                  `🟢 *Trạng thái:* Đã xác minh & đang hoạt động\n\n` +
                  `⚠️ _Key có hiệu lực ngay lập tức trong phiên chạy hiện tại._\n` +
                  `_Để lưu vĩnh viễn: cập nhật \`GEMINI_API_KEY\` trong .env_`,
                  { reply_markup: { inline_keyboard: [[{ text: "⚙️ Quản lý API Keys", callback_data: "cmd_apikeys" }], [{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } }
                );
              } else {
                testResult = `HTTP ${testRes.status}`;
                throw new Error(testResult);
              }
            } catch (e: any) {
              await sendMessage(chatId,
                `❌ *KEY KHÔNG HỢP LỆ!*\n\n` +
                `Lỗi khi kiểm tra key: ${e.message || 'Không kết nối được'}\n\n` +
                `_Key chưa được áp dụng. Vui lòng kiểm tra lại._`,
                { reply_markup: { inline_keyboard: [[{ text: "🔙 Quay lại API Keys", callback_data: "cmd_apikeys" }]] } }
              );
            }
            return;
          }
        }

        // Normal Commands
        if (text === '/menu' || text === '/start') {
          await sendMainMenu(chatId);
        } else if (text === '/getid') {
          await sendMessage(chatId,
            `🆔 *Chat ID của bạn:*\n\`${chatId}\`\n\n` +
            `_Dùng giá trị này để cấu hình \`TELEGRAM_CHAT_ID\` trong .env_`
          );
        } else if (text === '/stats') {
          const fakeQuery = { callback_query: { data: 'cmd_stats', message: { chat: { id: chatId }, message_id: 0 }, id: '' } };
          await processUpdate(fakeQuery);
        } else if (text === '/pending') {
          const fakeQuery = { callback_query: { data: 'cmd_pending', message: { chat: { id: chatId }, message_id: 0 }, id: '' } };
          await processUpdate(fakeQuery);
        } else if (text === '/apikeys') {
          const fakeQuery = { callback_query: { data: 'cmd_apikeys', message: { chat: { id: chatId }, message_id: 0 }, id: '' } };
          await processUpdate(fakeQuery);
        } else {
          // Unknown text — show menu
          await sendMainMenu(chatId);
        }
      }
    };

    setInterval(async () => {
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=${offset}&timeout=10`);
        const data = await response.json();

        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            await processUpdate(update);
          }
        }
      } catch (e) {
        console.error("Telegram polling error", e);
      }
    }, 2000);
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
