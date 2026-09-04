import type { Locale } from '@/lib/i18n/locale';

/**
 * The FAQ published in the owner's product document
 * (NB Engineering Tools for AutoCAD.pdf, pages 13-15), rendered on the page and
 * emitted as FAQPage structured data.
 *
 * Answers are the owner's own. Nothing is added, softened or extrapolated here:
 * a question the document does not answer does not appear.
 *
 * The English text is a translation of those same answers, kept beside the
 * Bengali rather than in the dictionary so the two can be read against each
 * other in one place. THE BENGALI IS THE RECORD: where the two could be read
 * differently - the token policy and the screenshot window especially - the
 * Bengali is what the owner published and what governs.
 */
export type Faq = {
  question: string;
  answer: string;
  questionEn: string;
  answerEn: string;
};

export const PRODUCT_FAQ: Faq[] = [
  {
    question: 'NB Engineering Tools কি AutoCAD ছাড়া ব্যবহার করা যাবে?',
    answer: 'না। বর্তমান ভার্সনটি AutoCAD-ভিত্তিক একটি engineering productivity suite।',
    questionEn: 'Can NB Engineering Tools be used without AutoCAD?',
    answerEn: 'No. The current version is an AutoCAD-based engineering productivity suite.',
  },
  {
    question: 'কোন AutoCAD ভার্সন সমর্থন করে?',
    answer:
      'বর্তমান commercial build AutoCAD 2024, 2025, 2026 ও 2027-এর জন্য তৈরি, Windows 10/11 '
      + '64-bit environment-এ। AutoCAD 2020–2023 বা এর আগের ভার্সন সমর্থিত নয়। কোন রিলিজে '
      + 'রানটাইম পরীক্ষা সম্পন্ন হয়েছে তা আলাদাভাবে জানানো হয়।',
    questionEn: 'Which AutoCAD versions does it support?',
    answerEn:
      'The current commercial build is made for AutoCAD 2024, 2025, 2026 and 2027, in a '
      + 'Windows 10/11 64-bit environment. AutoCAD 2020–2023 and earlier are not supported. '
      + 'Which releases have completed runtime testing is stated separately.',
  },
  {
    question: 'সফটওয়্যার কি Windows 11-এ চলে?',
    answer: 'হ্যাঁ। বর্তমান target environment Windows 10/11 64-bit।',
    questionEn: 'Does the software run on Windows 11?',
    answerEn: 'Yes. The current target environment is Windows 10/11 64-bit.',
  },
  {
    question: 'Footing design আছে?',
    answer:
      'হ্যাঁ। NBFooting isolated footing design/drawing workflow সমর্থন করে, এবং combined '
      + 'footing-এর জন্য আলাদা মডিউল রয়েছে।',
    questionEn: 'Is there footing design?',
    answerEn:
      'Yes. NBFooting supports an isolated footing design/drawing workflow, and there is a '
      + 'separate module for combined footings.',
  },
  {
    question: 'Pile cap design আছে?',
    answer: 'হ্যাঁ। NBPileCap মডিউল pile-cap design/drawing ও reinforcement workflow সমর্থন করে।',
    questionEn: 'Is there pile cap design?',
    answerEn:
      'Yes. The NBPileCap module supports a pile-cap design/drawing and reinforcement workflow.',
  },
  {
    question: 'Slab reinforcement drawing করা যায়?',
    answer: 'হ্যাঁ। NBSlabDraw slab reinforcement automation-এর জন্য তৈরি।',
    questionEn: 'Can it draw slab reinforcement?',
    answerEn: 'Yes. NBSlabDraw is made for slab reinforcement automation.',
  },
  {
    question: 'Token কী?',
    answer: 'Token হলো সফটওয়্যারের নির্দিষ্ট paid operation ব্যবহারের ক্রেডিট।',
    questionEn: 'What is a token?',
    answerEn: 'A token is credit for using a specific paid operation in the software.',
  },
  {
    question: 'আমি কি custom পরিমাণের token কিনতে পারি?',
    answer: 'হ্যাঁ। Vendor-approved custom token refill issue করা সম্ভব।',
    questionEn: 'Can I buy a custom number of tokens?',
    answerEn: 'Yes. A vendor-approved custom token refill can be issued.',
  },
  {
    question: 'Windows setup দিলে token থাকবে?',
    answer:
      'Windows reinstall বা format করলে স্থানীয় token ডেটা হারাতে পারে। Token 0 হয়ে গেলে '
      + 'standard policy অনুযায়ী নতুন token কিনতে হবে।',
    questionEn: 'Do tokens survive a Windows reinstall?',
    answerEn:
      'Reinstalling or formatting Windows can lose the local token data. If the token count '
      + 'reaches 0, standard policy is that new tokens have to be bought.',
  },
  {
    question: 'Windows setup-এর আগে token balance-এর screenshot থাকলে কী হবে?',
    answer:
      'Windows setup-এর সর্বোচ্চ ৩০ মিনিট আগে নেওয়া স্পষ্ট ও যাচাইযোগ্য screenshot থাকলে, '
      + 'ভেন্ডর যাচাইয়ের পর সেখানে দেখানো অবশিষ্ট balance পুনরায় issue করা যেতে পারে।',
    questionEn: 'What if I have a screenshot of the token balance from before the reinstall?',
    answerEn:
      'If you have a clear, verifiable screenshot taken no more than 30 minutes before the '
      + 'Windows setup, the remaining balance shown in it may be reissued after vendor '
      + 'verification.',
  },
  {
    question: 'Screenshot না থাকলে?',
    answer: 'বিনামূল্যে token restore করা হবে না; নতুন token কিনতে হবে।',
    questionEn: 'And without a screenshot?',
    answerEn: 'Tokens are not restored free of charge; new tokens have to be bought.',
  },
  {
    question: 'শুধু AutoCAD uninstall করলে?',
    answer:
      'শুধু AutoCAD uninstall করলে এবং Windows-এর NB licensing ডেটা অক্ষত থাকলে '
      + 'activation ও token সাধারণত থেকে যায়।',
    questionEn: 'What if I only uninstall AutoCAD?',
    answerEn:
      'If only AutoCAD is uninstalled and the NB licensing data in Windows is left intact, '
      + 'the activation and the tokens usually remain.',
  },
  {
    question: 'সফটওয়্যারের আউটপুট কি প্রকৌশলীকে যাচাই করতে হবে?',
    answer:
      'অবশ্যই। NB Engineering Tools একটি automation ও productivity aid; চূড়ান্ত engineering '
      + 'দায়িত্ব যোগ্য প্রকৌশলীর।',
    questionEn: 'Does an engineer have to check the software’s output?',
    answerEn:
      'Absolutely. NB Engineering Tools is an automation and productivity aid; the final '
      + 'engineering responsibility rests with the qualified engineer.',
  },
];

/** The FAQ in one language, for rendering and for the FAQPage structured data. */
export function productFaq(locale: Locale): { question: string; answer: string }[] {
  return PRODUCT_FAQ.map((item) =>
    locale === 'en'
      ? { question: item.questionEn, answer: item.answerEn }
      : { question: item.question, answer: item.answer },
  );
}
