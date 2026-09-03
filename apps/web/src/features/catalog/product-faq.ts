/**
 * The FAQ published in the owner's product document
 * (NB Engineering Tools for AutoCAD.pdf, pages 13-15), rendered on the page and
 * emitted as FAQPage structured data.
 *
 * Answers are the owner's own. Nothing is added, softened or extrapolated here:
 * a question the document does not answer does not appear.
 */
export type Faq = { question: string; answer: string };

export const PRODUCT_FAQ: Faq[] = [
  {
    question: 'NB Engineering Tools কি AutoCAD ছাড়া ব্যবহার করা যাবে?',
    answer: 'না। বর্তমান ভার্সনটি AutoCAD-ভিত্তিক একটি engineering productivity suite।',
  },
  {
    question: 'কোন AutoCAD ভার্সন সমর্থন করে?',
    answer:
      'বর্তমান commercial build AutoCAD 2024, 2025, 2026 ও 2027-এর জন্য তৈরি, Windows 10/11 '
      + '64-bit environment-এ। AutoCAD 2020–2023 বা এর আগের ভার্সন সমর্থিত নয়। কোন রিলিজে '
      + 'রানটাইম পরীক্ষা সম্পন্ন হয়েছে তা আলাদাভাবে জানানো হয়।',
  },
  {
    question: 'সফটওয়্যার কি Windows 11-এ চলে?',
    answer: 'হ্যাঁ। বর্তমান target environment Windows 10/11 64-bit।',
  },
  {
    question: 'Footing design আছে?',
    answer:
      'হ্যাঁ। NBFooting isolated footing design/drawing workflow সমর্থন করে, এবং combined '
      + 'footing-এর জন্য আলাদা মডিউল রয়েছে।',
  },
  {
    question: 'Pile cap design আছে?',
    answer: 'হ্যাঁ। NBPileCap মডিউল pile-cap design/drawing ও reinforcement workflow সমর্থন করে।',
  },
  {
    question: 'Slab reinforcement drawing করা যায়?',
    answer: 'হ্যাঁ। NBSlabDraw slab reinforcement automation-এর জন্য তৈরি।',
  },
  {
    question: 'Token কী?',
    answer: 'Token হলো সফটওয়্যারের নির্দিষ্ট paid operation ব্যবহারের ক্রেডিট।',
  },
  {
    question: 'আমি কি custom পরিমাণের token কিনতে পারি?',
    answer: 'হ্যাঁ। Vendor-approved custom token refill issue করা সম্ভব।',
  },
  {
    question: 'Windows setup দিলে token থাকবে?',
    answer:
      'Windows reinstall বা format করলে স্থানীয় token ডেটা হারাতে পারে। Token 0 হয়ে গেলে '
      + 'standard policy অনুযায়ী নতুন token কিনতে হবে।',
  },
  {
    question: 'Windows setup-এর আগে token balance-এর screenshot থাকলে কী হবে?',
    answer:
      'Windows setup-এর সর্বোচ্চ ৩০ মিনিট আগে নেওয়া স্পষ্ট ও যাচাইযোগ্য screenshot থাকলে, '
      + 'ভেন্ডর যাচাইয়ের পর সেখানে দেখানো অবশিষ্ট balance পুনরায় issue করা যেতে পারে।',
  },
  {
    question: 'Screenshot না থাকলে?',
    answer: 'বিনামূল্যে token restore করা হবে না; নতুন token কিনতে হবে।',
  },
  {
    question: 'শুধু AutoCAD uninstall করলে?',
    answer:
      'শুধু AutoCAD uninstall করলে এবং Windows-এর NB licensing ডেটা অক্ষত থাকলে '
      + 'activation ও token সাধারণত থেকে যায়।',
  },
  {
    question: 'সফটওয়্যারের আউটপুট কি প্রকৌশলীকে যাচাই করতে হবে?',
    answer:
      'অবশ্যই। NB Engineering Tools একটি automation ও productivity aid; চূড়ান্ত engineering '
      + 'দায়িত্ব যোগ্য প্রকৌশলীর।',
  },
];
