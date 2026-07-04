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
const appUrl = process.env.APP_URL;

// Set webhook on startup if token and url are provided
if (botToken) {
  fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`)
    .then(() => console.log("Webhook deleted, starting polling..."))
    .catch(e => console.error("Error deleting webhook:", e));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Route
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

  // Telegram Payment Notification Route
  app.post("/api/telegram/payment", async (req, res) => {
    try {
      const { userEmail, userName, packageLabel, price, imageUrl, transactionId } = req.body;
      const botToken = process.env.TELEGRAM_BOT_TOKEN || "8921472886:AAFcmsM2xVoWlHMYYDrjX58r4DMY6tRMymc";
      const chatId = process.env.TELEGRAM_CHAT_ID || "8407449803";

      if (!botToken || !chatId) {
        return res.status(500).json({ error: "Telegram configuration is missing in .env" });
      }

      const message = `🔔 *Yêu cầu thanh toán mới*\n\n` +
                      `👤 Người dùng: ${userName} (${userEmail})\n` +
                      `📦 Gói: ${packageLabel}\n` +
                      `💰 Số tiền: ${price}\n` +
                      `🔖 Mã GD: \`${transactionId}\`\n\n` +
                      `Vui lòng vào trang quản trị để xác duyệt.`;

      const appUrl = process.env.APP_URL || "https://ais-pre-7gknx44f477mb6hpqcpqb3-175783911227.asia-southeast1.run.app";
      const replyMarkup = {
        inline_keyboard: [
          [
            { 
              text: "✅ Duyệt ngay", 
              callback_data: `approve_tx_${transactionId}` 
            },
            { 
              text: "❌ Từ chối", 
              callback_data: `reject_tx_${transactionId}` 
            }
          ]
        ]
      };

      // If we have an image URL, send a photo, otherwise just a text message
      let url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      let body: any = {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup
      };

      if (imageUrl && imageUrl.startsWith("http")) {
        url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
        body = {
          chat_id: chatId,
          photo: imageUrl,
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.description || "Failed to send Telegram message");
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Telegram API Error:", error);
      res.status(500).json({ error: error.message || "Failed to notify Telegram" });
    }
  });

  
  // Telegram Polling loop
  if (botToken) {
    let offset = 0;
    
    const processUpdate = async (update: any) => {
      const chatIdAllowed = process.env.TELEGRAM_CHAT_ID || "8407449803";
      
      if (!getApps().length) {
        console.warn("Firebase Admin not initialized, cannot process Telegram update.");
        return;
      }
      
      const db = getFirestore();

      const sendMainMenu = async (chatId: string) => {
         const menuMessage = `🌟 *HỆ THỐNG QUẢN TRỊ EDUCREATE* 🌟\n\n` + 
                             `👋 Chào mừng Quản trị viên!\n` +
                             `Hãy chọn chức năng bên dưới:\n`;
         
         const markup = {
           inline_keyboard: [
             [{ text: "🔍 Tìm người dùng", callback_data: "cmd_prompt_find" }, { text: "📋 GD Chờ duyệt", callback_data: "cmd_pending" }],
             [{ text: "💰 Tặng Coin", callback_data: "cmd_prompt_addcoin" }, { text: "📦 Cấp Gói", callback_data: "cmd_prompt_setpkg" }]
           ]
         };

         await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            chat_id: chatId,
            text: menuMessage,
            parse_mode: 'Markdown',
            reply_markup: markup
          })
        });
      };

      // Handle Callback Queries (Button Clicks)
      if (update.callback_query) {
        const query = update.callback_query;
        const data = query.data;
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;

        // Verify admin
        if (chatId.toString() !== chatIdAllowed.toString()) return;

        // Answer all callbacks gracefully
        fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ callback_query_id: query.id })
        }).catch(() => {});

        if (data === 'cmd_prompt_find') {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              chat_id: chatId,
              text: '🔍 *TÌM NGƯỜI DÙNG*\n\nVui lòng Reply (Trả lời) tin nhắn này kèm theo Email cần tìm:',
              parse_mode: 'Markdown',
              reply_markup: { force_reply: true }
            })
          });
          return;
        } else if (data === 'cmd_prompt_addcoin') {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              chat_id: chatId,
              text: '💰 *TẶNG COIN*\n\nVui lòng Reply (Trả lời) tin nhắn này theo cú pháp:\n\`<Email> <Số_Coin>\`\n\n_(Ví dụ: admin@gmail.com 50000)_',
              parse_mode: 'Markdown',
              reply_markup: { force_reply: true }
            })
          });
          return;
        } else if (data === 'cmd_prompt_setpkg') {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              chat_id: chatId,
              text: '📦 *CẤP GÓI TÀI KHOẢN*\n\nVui lòng Reply (Trả lời) tin nhắn này theo cú pháp:\n\`<Email> <Tên_Gói>\`\n\n_(Gói: pro / enterprise / free)_\n_(Ví dụ: admin@gmail.com pro)_',
              parse_mode: 'Markdown',
              reply_markup: { force_reply: true }
            })
          });
          return;
        } else if (data === 'cmd_pending') {
          const q = await db.collection('transactions').where('status', '==', 'pending').orderBy('createdAt', 'desc').limit(5).get();
          if (q.empty) {
             await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: chatId, text: `✅ *Tuyệt vời!*\nHiện tại không có giao dịch nào đang chờ duyệt.`, parse_mode: 'Markdown'})});
          } else {
             await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: chatId, text: `📋 *Danh sách 5 giao dịch chờ duyệt mới nhất:*`, parse_mode: 'Markdown'})});
             for (const doc of q.docs) {
               const tx = doc.data();
               const amountStr = tx.type === 'deposit' ? `\n💰 *Số tiền:* ${Number(tx.amount || 0).toLocaleString()}đ` : '';
               const msg = `👤 *Người dùng:* ${tx.userName || 'Không rõ'} (${tx.userEmail})\n🔖 *Mã GD:* \`${doc.id}\`\n📦 *Yêu cầu:* ${tx.packageLabel || tx.packageKey || (tx.type === 'deposit' ? 'Nạp Coin' : '')}${amountStr}`;
               const markup = {
                 inline_keyboard: [[
                   { text: "✅ Duyệt", callback_data: `approve_tx_${doc.id}` },
                   { text: "❌ Từ chối", callback_data: `reject_tx_${doc.id}` }
                 ]]
               };
               if (tx.imageUrl && tx.imageUrl.startsWith("http")) {
                 await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: chatId, photo: tx.imageUrl, caption: msg, reply_markup: markup, parse_mode: 'Markdown' })});
               } else {
                 await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: chatId, text: msg, reply_markup: markup, parse_mode: 'Markdown' })});
               }
             }
          }
          return;
        } else if (data.startsWith('approve_tx_')) {
          const txId = data.replace('approve_tx_', '');
          const txRef = db.collection('transactions').doc(txId);
          const txDoc = await txRef.get();
          if (txDoc.exists) {
            const txData = txDoc.data();
            if (txData && txData.status === 'pending') {
              // Approve logic
              await txRef.update({ status: 'approved', processedAt: FieldValue.serverTimestamp() });
              
              if (txData.type === 'deposit') {
                const amount = Number(txData.amount || 0);
                const userRef = db.collection('users').doc(txData.userId);
                await userRef.set({ coins: FieldValue.increment(amount) }, { merge: true });
                
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
                const days = Number(txData.days || 30);
                date.setDate(date.getDate() + days);
                
                const userRef = db.collection('users').doc(txData.userId);
                await userRef.set({
                  package: txData.packageKey || 'pro',
                  expiresAt: date.toISOString(),
                  usageCount: 0
                }, { merge: true });
                
                await db.collection('notifications').add({
                  userId: txData.userId,
                  type: 'system',
                  title: 'Giao dịch đã được duyệt!',
                  message: `Yêu cầu kích hoạt gói ${txData.packageLabel} của bạn đã được duyệt thành công. Hạn sử dụng đến ngày ${date.toLocaleDateString('vi-VN')}.`,
                  createdAt: FieldValue.serverTimestamp(),
                  read: false
                });
              }

              // Edit message
              await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: messageId,
                  reply_markup: { inline_keyboard: [] }
                })
              });
              await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `✅ Đã duyệt thành công giao dịch cho **${txData.userEmail}**:\n${txId}`, parse_mode: 'Markdown'
                })
              });
            } else {
               await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `⚠️ Giao dịch \n${txId}\nđã được xử lý trước đó.`, parse_mode: 'Markdown'
                })
              });
            }
          }
        } else if (data.startsWith('reject_tx_')) {
          const txId = data.replace('reject_tx_', '');
          const txRef = db.collection('transactions').doc(txId);
          await txRef.update({ status: 'rejected', processedAt: FieldValue.serverTimestamp() });
          
          let userEmail = 'Không rõ';
          const txDoc = await txRef.get();
          if (txDoc.exists) {
            const txData = txDoc.data();
            if (txData) {
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
          }
          
          await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: messageId,
                  reply_markup: { inline_keyboard: [] }
                })
          });
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              chat_id: chatId,
              text: `❌ Đã từ chối giao dịch của **${userEmail}**:\n${txId}`, parse_mode: 'Markdown'
            })
          });
        }
      }

      // Handle Text Commands and Replies
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        if (chatId.toString() !== chatIdAllowed.toString()) return;
        
        const text = update.message.text.trim();
        
        // Check if this is a reply to a ForceReply prompt
        if (update.message.reply_to_message && update.message.reply_to_message.text) {
          const prompt = update.message.reply_to_message.text;
          
          if (prompt.includes('TÌM NGƯỜI DÙNG')) {
            const email = text;
            const usersRef = db.collection('users');
            const q = await usersRef.where('email', '==', email).get();
            if (q.empty) {
               await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: chatId, text: '❌ *Không tìm thấy người dùng!*\nVui lòng kiểm tra lại địa chỉ email.', parse_mode: 'Markdown'})});
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
               await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown'})});
            }
          } else if (prompt.includes('TẶNG COIN')) {
            const parts = text.split(/\s+/);
            const email = parts[0];
            const amount = parseInt(parts[1]);
            if (email && !isNaN(amount)) {
              const q = await db.collection('users').where('email', '==', email).get();
              if (!q.empty) {
                 const ref = q.docs[0].ref;
                 await db.runTransaction(async (t) => {
                   const doc = await t.get(ref);
                   const current = doc.data().coins || 0;
                   t.update(ref, { coins: current + amount });
                 });
                 await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: chatId, text: `✅ *THÀNH CÔNG*\n\nĐã cộng *${amount.toLocaleString()} Coin* cho tài khoản \`${email}\`.`, parse_mode: 'Markdown'})});
              } else {
                 await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: chatId, text: '❌ *Không tìm thấy người dùng!*', parse_mode: 'Markdown'})});
              }
            } else {
               await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: chatId, text: '❌ *Cú pháp không hợp lệ!*\nVui lòng nhập đúng: \n\`<Email> <Số_Coin>\`', parse_mode: 'Markdown'})});
            }
          } else if (prompt.includes('CẤP GÓI')) {
            const parts = text.split(/\s+/);
            const email = parts[0];
            const pkg = parts[1]?.toLowerCase();
            if (email && ['pro', 'enterprise', 'free'].includes(pkg)) {
              const q = await db.collection('users').where('email', '==', email).get();
              if (!q.empty) {
                 const doc = q.docs[0];
                 const validity = pkg === 'pro' ? 30 : pkg === 'enterprise' ? 365 : 0;
                 const now = new Date();
                 const newExp = new Date(now.getTime() + validity*24*60*60*1000);
                 await doc.ref.update({ package: pkg, expiresAt: newExp.toISOString() });
                 await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: chatId, text: `✅ *THÀNH CÔNG*\n\nĐã cập nhật gói *${pkg.toUpperCase()}* cho tài khoản \`${email}\`.`, parse_mode: 'Markdown'})});
              } else {
                 await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: chatId, text: '❌ *Không tìm thấy người dùng!*', parse_mode: 'Markdown'})});
              }
            } else {
               await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: chatId, text: '❌ *Cú pháp không hợp lệ!*\nVui lòng nhập đúng: \n\`<Email> <pro|enterprise|free>\`', parse_mode: 'Markdown'})});
            }
          }
        } 
        // Normal Commands
        else if (text === '/menu' || text === '/start') {
           await sendMainMenu(chatId);
        } else if (text.startsWith('/find ') || text.startsWith('/addcoin ') || text.startsWith('/setpkg ') || text === '/pending') {
           // We can keep the old text-based commands as fallbacks if needed, but since we are moving to buttons, let's just suggest the menu.
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
