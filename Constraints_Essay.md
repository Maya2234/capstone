# CardMaxx (formerly CardStack): Constraints Essay

## Team Members
- Maya Tomarchio
- Luke Brogee

### Economic
Financial limitations may arise due to the cost of the API integrations needed to keep users' financial information secure. Personal funds will be used if funding is necessary for the implementation of the project. The project idea will be entered into the innovation challenge at UC for potential additional prototype funding.

### Professional
Upon successful completion of the prototype and concept, networking opportunities will arise from sharing the project and seeking opportunities for implementation. Professional expertise will most likely be needed closer to the final stages of the project and will be sought from appropriate faculty at the University.

### Security
Due to the sensitive nature of user card and bank information, appropriate security measures will need to be taken to ensure the safety and security of the financial information the application uses. This process will be planned, documented, tested, and overseen by faculty and other experts in application security. Specifically, users sign in through Supabase with an email and password, can turn on two-factor login with an authenticator app, and are signed out after 30 minutes of inactivity. Bank access tokens are encrypted at rest with AES-256, all traffic uses HTTPS, and the database only lets each user read their own data. Webhooks between CardMaxx, Plaid, and merchants are to be signed so forged messages are rejected. API keys and secrets are kept out of the repository. Google sign-in is planned for a later release.

### Social
This project is meant to benefit users financially by giving them the most rewards and return on their spending. It should also offer a quality-of-life benefit to users, who gain rewards of real monetary value without extra effort. There must be no fees for users, to keep the platform accessible and beneficial to the general public.

### Ethical
CardMaxx asks users to trust it with their credit cards, spending history, and purchasing decisions, so it must act in the user's interest and be open about how it does so. Card selection will always pick the card that earns the user the most rewards. It will never favor a card issuer or merchant that pays CardMaxx. Every purchase shows the amount, the merchant, and the selected card before the user is charged, and the user can choose a different card or cancel. If a card is declined, the user is asked before another card is charged. The app tells users when reward rates may be out of date, since issuers change them often, and it links to the issuer's page so the numbers can be checked. Only the data needed to choose a card and complete a payment is collected, and users can remove a linked card at any time. Any use of AI tools in building CardMaxx will be disclosed, and design decisions will remain the team's own.

### Legal
CardMaxx handles payment data, so it must follow card network and financial privacy rules. To stay out of scope for PCI DSS (the Payment Card Industry Data Security Standard), CardMaxx will never store, log, or transmit full card numbers. Cards are linked through Plaid and charged through a payment processor using tokens, so card numbers stay with those regulated providers. Use of Plaid, the payment processor, and any sign-in provider must follow each provider's developer terms. During the course, only sandbox (test) accounts and the team members' own accounts are used. Consumer financial data is protected by laws such as the Gramm-Leach-Bliley Act, so users must be told what is collected and why, and they must agree before any account is linked. All third-party code and data used in the project will be listed with its license, and the project will not include code whose license conflicts with our own. Card issuer and card names are trademarks and will only be used to describe the cards, not to suggest any partnership or endorsement.

### Diversity and Cultural
CardMaxx is meant to benefit the general public, not only people who already hold several premium rewards cards. The app works with no-annual-fee and everyday cash-back cards as well as travel cards, and it never charges users a fee, so the benefit doesn't depend on income. Recommendations are based only on the purchase category and the user's own cards, never on personal traits such as age, gender, location, or background. The interfaces are designed to be accessible, with readable text, support for light and dark modes, and screen-reader labels on buttons. Language avoids financial jargon so first-time credit card users can understand what CardMaxx is doing. The first release supports US dollars and US merchants only. This is a known limitation that excludes international users, and it is recorded in the requirements as out of scope rather than ignored.
