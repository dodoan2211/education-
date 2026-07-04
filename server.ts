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

// ---------- Menu Builders ----------
function buildMainMenuMarkup() {
  return {
    inline_keyboard: [
      [
        { text: "📊 Thống kê tổng quan", callback_data: "cmd_stats" },
        { text: "📋 GD Chờ duyệt", callback_data: "cmd_pending" }
      ],
      [
        { text: "🔍 Tìm người dùng", callback_data: "cmd_prompt_find" },
        { text: "👥 Danh sách NSD", callback_data: "cmd_prompt_listusers" }
      ],
      [
        { text: "💰 Tặng Coin", callback_data: "cmd_prompt_addcoin" },
        { text: "📦 Cấp Gói", callback_data: "cmd_prompt_setpkg" }
      ],
      [
        { text: "🏆 Cuộc thi & Bài nộp", callback_data: "cmd_competitions" },
        { text: "📝 Bài viết cộng đồng", callback_data: "cmd_posts" }
      ],
      [
        { text: "📢 Gửi thông báo broadcast", callback_data: "cmd_prompt_broadcast" }
      ]
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
      const { prompt, type } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
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
        await sendMessage(chatId,
          `🌟 *HỆ THỐNG QUẢN TRỊ EDUCREATE* 🌟\n\n` +
          `👋 Chào mừng Quản trị viên!\n` +
          `Hãy chọn chức năng bên dưới:`,
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
            const [usersSnap, txSnap, postsSnap, subsSnap] = await Promise.all([
              db.collection('users').get(),
              db.collection('transactions').where('status', '==', 'pending').get(),
              db.collection('posts').get(),
              db.collection('submissions').get()
            ]);

            const allUsers = usersSnap.docs.map(d => d.data());
            const proUsers = allUsers.filter(u => u.package === 'pro').length;
            const enterpriseUsers = allUsers.filter(u => u.package === 'enterprise').length;
            const freeUsers = allUsers.filter(u => !u.package || u.package === 'free').length;

            const msg = `📊 *THỐNG KÊ TỔNG QUAN*\n\n` +
                        `👥 *Tổng người dùng:* ${usersSnap.size}\n` +
                        `   ├ 🆓 Free: ${freeUsers}\n` +
                        `   ├ ⚡ Pro: ${proUsers}\n` +
                        `   └ 🏢 Enterprise: ${enterpriseUsers}\n\n` +
                        `💳 *GD đang chờ duyệt:* ${txSnap.size}\n` +
                        `📝 *Bài viết cộng đồng:* ${postsSnap.size}\n` +
                        `🏆 *Bài dự thi đã nộp:* ${subsSnap.size}\n\n` +
                        `🕐 _Cập nhật: ${new Date().toLocaleString('vi-VN')}_`;

            await sendMessage(chatId, msg, {
              reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] }
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
            await sendMessage(chatId, `✅ *Tuyệt vời!*\nHiện tại không có giao dịch nào đang chờ duyệt.`,
              { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } });
          } else {
            await sendMessage(chatId, `📋 *Danh sách ${q.size} giao dịch chờ duyệt mới nhất:*`);
            for (const docRef of q.docs) {
              const tx = docRef.data();
              const amountStr = tx.type === 'deposit' ? `\n💰 *Số tiền:* ${Number(tx.amount || 0).toLocaleString()}đ` : '';
              const msg = `👤 *Người dùng:* ${tx.userName || 'Không rõ'} (${tx.userEmail})\n` +
                          `🔖 *Mã GD:* \`${docRef.id}\`\n` +
                          `📦 *Yêu cầu:* ${tx.packageLabel || tx.packageKey || (tx.type === 'deposit' ? 'Nạp Coin' : '')}${amountStr}`;
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
          }
          return;
        }

        // --- Competitions & Submissions ---
        if (data === 'cmd_competitions') {
          const subsSnap = await db.collection('submissions').orderBy('submittedAt', 'desc').limit(5).get();
          if (subsSnap.empty) {
            await sendMessage(chatId, `🏆 *Chưa có bài dự thi nào được nộp.*`,
              { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } });
          } else {
            await sendMessage(chatId, `🏆 *5 bài dự thi mới nhất:*`);
            for (const d of subsSnap.docs) {
              const sub = d.data();
              const statusEmoji = sub.status === 'Đã chấm điểm' ? '✅' : '⏳';
              const gradeStr = sub.grade ? ` — Loại: *${sub.grade}*` : '';
              const msg = `${statusEmoji} *${sub.userName}* (${sub.userEmail})\n` +
                          `📄 *Tài liệu:* ${sub.resourceTitle}\n` +
                          `🥇 *Cuộc thi:* ${sub.competitionTitle}\n` +
                          `📊 *Trạng thái:* ${sub.status}${gradeStr}`;
              await sendMessage(chatId, msg);
            }
            await sendMessage(chatId, `_Để chấm điểm, vui lòng truy cập trang Quản trị._`,
              { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } });
          }
          return;
        }

        // --- Community posts ---
        if (data === 'cmd_posts') {
          const postsSnap = await db.collection('posts').orderBy('createdAt', 'desc').limit(5).get();
          if (postsSnap.empty) {
            await sendMessage(chatId, `📝 *Chưa có bài viết cộng đồng nào.*`,
              { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } });
          } else {
            await sendMessage(chatId, `📝 *5 bài viết cộng đồng mới nhất:*`);
            for (const d of postsSnap.docs) {
              const post = d.data();
              const preview = (post.content || '').slice(0, 150);
              const msg = `👤 *${post.userName}*\n💬 ${preview}\n🔖 ID: \`${d.id}\``;
              await sendMessage(chatId, msg, {
                reply_markup: {
                  inline_keyboard: [[
                    { text: "🗑 Xóa", callback_data: `delete_post_${d.id}` },
                    { text: "➡ Tiếp", callback_data: "noop" }
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
            '📢 *GỬI THÔNG BÁO BROADCAST*\n\nVui lòng Reply (Trả lời) tin nhắn này với nội dung thông báo muốn gửi tới tất cả người dùng:',
            { reply_markup: { force_reply: true, selective: true } }
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
              }

              await tgSend('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
              await sendMessage(chatId, `✅ Đã duyệt thành công giao dịch cho *${txData.userEmail}*\nMã: \`${txId}\``);
            } else {
              await sendMessage(chatId, `⚠️ Giao dịch \`${txId}\` đã được xử lý trước đó.`);
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
          await sendMessage(chatId, `❌ Đã từ chối giao dịch của *${userEmail}*\nMã: \`${txId}\``);
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
            const exp = u.expiresAt ? new Date(u.expiresAt).toLocaleDateString('vi-VN') : 'Không có';
            const msg = `👤 *THÔNG TIN NGƯỜI DÙNG*\n\n` +
                        `📧 *Email:* ${u.email}\n` +
                        `📛 *Tên:* ${u.displayName || 'Chưa cập nhật'}\n` +
                        `📦 *Gói:* ${(u.package || 'FREE').toUpperCase()}\n` +
                        `⏳ *Hạn sử dụng:* ${exp}\n` +
                        `💰 *Coin:* ${Number(u.coins || 0).toLocaleString()}\n` +
                        `🔑 *UID:* \`${userDoc.id}\``;
            await sendMessage(chatId, msg, {
              reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] }
            });
          } else {
            await sendMessage(chatId, `❌ Không tìm thấy người dùng.`);
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
              await sendMessage(chatId, '❌ *Không tìm thấy người dùng!*\nVui lòng kiểm tra lại địa chỉ email.');
            } else {
              const doc = q.docs[0];
              const u = doc.data();
              const exp = u.expiresAt ? new Date(u.expiresAt).toLocaleDateString('vi-VN') : 'Không có';
              const msg = `👤 *THÔNG TIN NGƯỜI DÙNG*\n\n` +
                          `📧 *Email:* ${u.email}\n` +
                          `📛 *Tên:* ${u.displayName || 'Chưa cập nhật'}\n` +
                          `📦 *Gói hiện tại:* ${(u.package || 'FREE').toUpperCase()}\n` +
                          `⏳ *Hạn sử dụng:* ${exp}\n` +
                          `💰 *Số dư Coin:* ${Number(u.coins || 0).toLocaleString()} Coin\n` +
                          `🔑 *ID:* \`${doc.id}\``;
              await sendMessage(chatId, msg, {
                reply_markup: {
                  inline_keyboard: [[
                    { text: "💰 Tặng Coin", callback_data: "cmd_prompt_addcoin" },
                    { text: "📦 Cấp Gói", callback_data: "cmd_prompt_setpkg" }
                  ], [
                    { text: "🔙 Menu chính", callback_data: "cmd_menu" }
                  ]]
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
                await sendMessage(chatId, `✅ *THÀNH CÔNG*\n\nĐã cộng *${amount.toLocaleString()} Coin* cho tài khoản \`${email}\`.`,
                  { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } });
              } else {
                await sendMessage(chatId, '❌ *Không tìm thấy người dùng!*');
              }
            } else {
              await sendMessage(chatId, '❌ *Cú pháp không hợp lệ!*\nVui lòng nhập: `<Email> <Số_Coin>`');
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
                await db.collection('notifications').add({
                  userId: q.docs[0].id,
                  type: 'system',
                  title: 'Gói tài khoản đã được cập nhật!',
                  message: `Admin đã cấp gói *${pkg.toUpperCase()}* cho tài khoản của bạn. Hạn sử dụng đến ${newExp.toLocaleDateString('vi-VN')}.`,
                  createdAt: FieldValue.serverTimestamp(),
                  read: false
                });
                await sendMessage(chatId, `✅ *THÀNH CÔNG*\n\nĐã cập nhật gói *${pkg.toUpperCase()}* cho tài khoản \`${email}\`.`,
                  { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } });
              } else {
                await sendMessage(chatId, '❌ *Không tìm thấy người dùng!*');
              }
            } else {
              await sendMessage(chatId, '❌ *Cú pháp không hợp lệ!*\nVui lòng nhập: `<Email> <pro|enterprise|free>`');
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
              await sendMessage(chatId, '❌ *Lọc không hợp lệ.* Nhập: pro, enterprise, free hoặc all');
              return;
            }

            if (q.empty) {
              await sendMessage(chatId, `📭 Không có người dùng nào với gói *${filter}*.`);
            } else {
              let list = `👥 *Danh sách người dùng (${filter.toUpperCase()}) — ${q.size} người:*\n\n`;
              q.docs.forEach((d, i) => {
                const u = d.data();
                list += `${i + 1}. *${u.displayName || 'N/A'}* — ${u.email} — ${(u.package || 'free').toUpperCase()}\n`;
              });
              await sendMessage(chatId, list, {
                reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] }
              });
            }
            return;
          }

          if (prompt.includes('BROADCAST')) {
            const broadcastText = text;
            const allUsersSnap = await db.collection('users').get();
            let count = 0;
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
              count++;
            }
            await batch.commit();
            await sendMessage(chatId,
              `📢 *BROADCAST THÀNH CÔNG!*\n\nĐã gửi thông báo tới *${count} người dùng*.\n\n📝 Nội dung:\n_${broadcastText}_`,
              { reply_markup: { inline_keyboard: [[{ text: "🔙 Menu chính", callback_data: "cmd_menu" }]] } }
            );
            return;
          }
        }

        // Normal Commands
        if (text === '/menu' || text === '/start') {
          await sendMainMenu(chatId);
        } else if (text === '/stats') {
          // Trigger stats via text command
          const fakeQuery = { callback_query: { data: 'cmd_stats', message: { chat: { id: chatId }, message_id: 0 }, id: '' } };
          await processUpdate(fakeQuery);
        } else if (text === '/pending') {
          const fakeQuery = { callback_query: { data: 'cmd_pending', message: { chat: { id: chatId }, message_id: 0 }, id: '' } };
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
