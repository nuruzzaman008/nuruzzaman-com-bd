import type { Locale } from '@/lib/i18n/locale';

/**
 * The FAQ on the engineering tools page, rendered there and emitted as FAQPage
 * structured data.
 *
 * From the owner's product document (NB Engineering Tools for AutoCAD.pdf,
 * pages 13-15), with the owner's later decisions: AutoCAD 2024-2027, and
 * 1,000 NB Credits with a single-PC licence. Questions the article already
 * answers in its own sections - footing, pile cap, slab - are left to the
 * article, and the three about reinstalling Windows are one question here.
 *
 * The English text is a translation kept beside the Bengali so the two can be
 * read against each other. THE BENGALI IS THE RECORD: where they could be read
 * differently - the credit policy and the screenshot window especially - the
 * Bengali governs.
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
    question: 'কোন AutoCAD ও Windows ভার্সনে চলে?',
    answer:
      'বর্তমান commercial build AutoCAD 2024, 2025, 2026 ও 2027-এর জন্য, Windows 10 ও Windows 11 ' +
      '64-bit-এ। AutoCAD 2020–2023 বা এর আগের ভার্সন সমর্থিত নয়।',
    questionEn: 'Which AutoCAD and Windows versions does it run on?',
    answerEn:
      'The current commercial build is for AutoCAD 2024, 2025, 2026 and 2027, on Windows 10 and ' +
      'Windows 11 64-bit. AutoCAD 2020–2023 and earlier are not supported.',
  },
  {
    question: 'NB Credit (Token) কী?',
    answer:
      'NB Credit হলো সফটওয়্যারের নির্দিষ্ট paid operation ব্যবহারের ক্রেডিট। AutoCAD-এর ' +
      'License & Tokens-এ এটি Token হিসেবে দেখায়।',
    questionEn: 'What is an NB Credit (Token)?',
    answerEn:
      'An NB Credit pays for using a specific paid operation in the software. AutoCAD shows it as ' +
      'a Token under License & Tokens.',
  },
  {
    question: 'লাইসেন্সের সাথে কি credit পাওয়া যায়?',
    answer:
      'হ্যাঁ। ১টি PC-র লাইসেন্সের সাথে 1,000 NB Credits দেওয়া হয়; activation সম্পন্ন হলে ' +
      'admin এটি refill হিসেবে issue করেন।',
    questionEn: 'Does a licence come with credits?',
    answerEn:
      'Yes. A single-PC licence comes with 1,000 NB Credits, which an admin issues as a refill ' +
      'once activation is complete.',
  },
  {
    question: 'আমি কি custom পরিমাণের credit কিনতে পারি?',
    answer: 'হ্যাঁ। ভেন্ডরের অনুমোদনে custom পরিমাণের credit refill issue করা যায়।',
    questionEn: 'Can I buy a custom number of credits?',
    answerEn: 'Yes. A custom credit refill can be issued with vendor approval.',
  },
  {
    question: 'Windows setup বা format দিলে credit থাকবে?',
    answer:
      'স্থানীয় credit ডেটা হারাতে পারে; balance 0 হলে standard policy অনুযায়ী নতুন credit ' +
      'কিনতে হবে। Windows setup-এর সর্বোচ্চ ৩০ মিনিট আগে নেওয়া স্পষ্ট ও যাচাইযোগ্য ' +
      'screenshot থাকলে, ভেন্ডর যাচাইয়ের পর সেখানে দেখানো অবশিষ্ট balance পুনরায় issue করা ' +
      'যেতে পারে। Screenshot না থাকলে বিনামূল্যে restore করা হয় না।',
    questionEn: 'Do my credits survive a Windows reinstall or format?',
    answerEn:
      'The local credit data can be lost; if the balance reaches 0, standard policy is that new ' +
      'credits have to be bought. With a clear, verifiable screenshot taken no more than 30 ' +
      'minutes before the Windows setup, the remaining balance it shows may be reissued after ' +
      'vendor verification. Without one, credits are not restored free of charge.',
  },
  {
    question: 'শুধু AutoCAD uninstall করলে?',
    answer:
      'শুধু AutoCAD uninstall করলে এবং Windows-এর NB licensing ডেটা অক্ষত থাকলে ' +
      'activation ও credit সাধারণত থেকে যায়।',
    questionEn: 'What if I only uninstall AutoCAD?',
    answerEn:
      'If only AutoCAD is uninstalled and the NB licensing data in Windows is left intact, ' +
      'the activation and the credits usually remain.',
  },
  {
    question: 'সফটওয়্যারের আউটপুট কি প্রকৌশলীকে যাচাই করতে হবে?',
    answer:
      'অবশ্যই। NB Engineering Tools একটি automation ও productivity aid; চূড়ান্ত engineering ' +
      'দায়িত্ব যোগ্য প্রকৌশলীর।',
    questionEn: 'Does an engineer have to check the software’s output?',
    answerEn:
      'Absolutely. NB Engineering Tools is an automation and productivity aid; the final ' +
      'engineering responsibility rests with the qualified engineer.',
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
