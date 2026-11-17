// Help content. Edit freely; the Help screen reads straight from here.

/** Leave phone empty to hide the call row. */
export const SUPPORT = {
  phone: '', // e.g. '+1 (555) 010-2030'
  hours: 'Mon–Fri, 9am–6pm ET',
};

// TODO(team): replace with real FAQs once we have them. These describe how the app works today.
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'How does CardMaxx pick a card?',
    a: 'At checkout we compare the cards you have turned on in Wallet and use the one that earns the most for that store’s category.',
  },
  {
    q: 'Can I keep a card from being used?',
    a: 'Yes. Switch it off in Wallet and CardMaxx will skip it until you turn it back on.',
  },
  {
    q: 'How do I connect a bank?',
    a: 'Tap Link account on Home. Connections go through Plaid, so CardMaxx never sees your bank login.',
  },
  {
    q: 'How do I disconnect a bank?',
    a: 'Open any account from that bank on Home and choose Disconnect.',
  },
  {
    q: 'Does CardMaxx cost anything?',
    a: 'No. There are no fees to use CardMaxx.',
  },
];

export const CONTACT_TOPICS = ['My account', 'Cards & rewards', 'A purchase', 'Something else'] as const;
