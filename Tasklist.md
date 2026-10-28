# Tasklist.md

CardStack — Task List (Design D3). Team: Luke Brogee, Maya Tomarchio.

T-01. Develop checkout_button embed script and domain verification logic. Module: Checkout Button. Owner: Luke.

T-02. Design and implement GET /server/v1/button/{id} validation endpoint. Module: Checkout Button. Owner: Luke.

T-03. Configure Authentication & User Account service with Google OAuth2 ID token verification. Module: Authentication & User Account. Owner: Maya.

T-04. Develop POST /server/v1/auth/google and /logout session management routes. Module: Authentication & User Account. Owner: Maya.

T-05. Specify relational schema in Supabase for user, session, and institution_link tables. Module: Card/Payment Information Store. Owner: Maya.

T-06. Implement user_card and reward_rule schema with encrypted processor token storage. Module: Card/Payment Information Store. Owner: Maya.

T-07. Develop Automatic Card Selection algorithm with scoring and tie-breaking logic. Module: Transaction & Card Selection Service. Owner: Luke.

T-08. Specify POST /server/v1/select-card endpoint returning ranked card lists. Module: Transaction & Card Selection Service. Owner: Luke.

T-09. Develop Card Processing integration with Payment Processor and idempotency keys. Module: Card Processing. Owner: Luke.

T-10. Implement transaction state machine (INITIATED, AUTHENTICATED, PROCESSING, SUCCEEDED, FAILED). Module: Card Processing. Owner: Maya.

T-11. Test Financial Institution Setup endpoint /connect-bank-account via Plaid webhooks. Module: Financial Institution Setup. Owner: Maya.

T-12. Develop Merchant Webhook sender with exponential backoff and retry queue. Module: Merchant webhook. Owner: Luke.

T-13. Implement Transaction History GET /server/v1/transactions paginated endpoint. Module: Transaction history. Owner: Luke.

T-14. Design Receipt Forwarding internal queue message handler for automated emails. Module: Receipt forwarding. Owner: Maya.

T-15. Develop React Native client screens for the mobile app (wallet, linked cards, card selection). Module: Mobile app & Web app. Owner: Luke.

T-16. Develop React Native web portal screens for card management and transaction history. Module: Mobile app & Web app. Owner: Maya.

T-17. Validate the end-to-end checkout flow (Checkout Button through Card Processing, Merchant webhook, and Receipt forwarding) with integration tests in the staging sandbox. Module: Transaction & Card Selection Service / Card Processing. Owner: Luke.
