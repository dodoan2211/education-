// Fire-and-forget Telegram notifications to admin.
// All calls are best-effort: failures are logged but never thrown.

async function notify(endpoint: string, payload: object) {
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => console.warn(`[Telegram] ${endpoint} failed:`, err));
}

export function notifyNewUser(userId: string, userName: string, userEmail: string) {
  notify('/api/telegram/new-user', { userId, userName, userEmail });
}

export function notifyNewPost(postId: string, userName: string, userEmail: string, content: string, imageUrl?: string) {
  notify('/api/telegram/new-post', { postId, userName, userEmail, content, imageUrl });
}

export function notifyNewSubmission(submissionId: string, userName: string, userEmail: string, competitionTitle: string, resourceTitle: string) {
  notify('/api/telegram/new-submission', { submissionId, userName, userEmail, competitionTitle, resourceTitle });
}

export function notifyGradeDone(adminName: string, userName: string, userEmail: string, resourceTitle: string, grade: string, competitionTitle: string) {
  notify('/api/telegram/grade-done', { adminName, userName, userEmail, resourceTitle, grade, competitionTitle });
}

export function notifyPayment(transactionId: string, userName: string, userEmail: string, packageLabel: string, price: string, imageUrl?: string) {
  notify('/api/telegram/payment', { transactionId, userName, userEmail, packageLabel, price, imageUrl });
}
