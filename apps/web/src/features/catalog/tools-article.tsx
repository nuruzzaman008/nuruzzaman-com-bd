import type { Locale } from '@/lib/i18n/locale';

// Adapted from the owner's NB Engineering Tools for AutoCAD.pdf, pages 1–12.
const sections = [
  {
    en: ['One AutoCAD workflow for structural engineering', 'NB Engineering Tools brings structural drawing, reinforcement detailing, foundation workflows, quantity estimation and layout preparation into AutoCAD. It is designed for civil and structural engineers, consultants, drafting professionals and design offices. A dedicated ribbon and pull-down menu provide access to the compiled tools without loading individual LSP files.'],
    bn: ['Structural engineering-এর কাজ এক AutoCAD workflow-তে', 'NB Engineering Tools দিয়ে AutoCAD-এর মধ্যে structural drawing, reinforcement detailing, foundation workflow, quantity estimation ও layout preparation করা যায়। Civil ও structural engineer, consultant, drafting professional এবং design office-এর কাজের জন্য এটি তৈরি। আলাদা LSP file load না করে dedicated Ribbon ও pull-down menu থেকে compiled tools চালানো যায়।'],
  },
  {
    en: ['Footing design, reinforcement, drawing and estimate', 'NBFooting combines footing selection, unique design grouping, structural inputs, design summaries, reinforcement, plan and section drawings, and estimates. Repeated identical footings can be organised as a unique design group. For example, 24 selected footings representing two unique designs are charged according to the successful unique-design policy, rather than as 24 separate designs. NBCombinedFooting provides a separate combined-footing workflow.'],
    bn: ['Footing design থেকে reinforcement, drawing ও estimate', 'NBFooting-এ footing selection, unique design grouping, structural input, design summary, reinforcement, plan/section drawing ও estimate এক workflow-তে থাকে। একই ধরনের footing-গুলো unique design group-এ সাজানো যায়। যেমন, ২৪টি selected footing-এ মাত্র ২টি unique design থাকলে সফল unique design অনুযায়ী token charge প্রযোজ্য হয়; ২৪টি আলাদা design হিসেবে নয়। Combined footing-এর জন্য রয়েছে NBCombinedFooting।'],
  },
  {
    en: ['Pile cap geometry and reinforcement', 'NBPileCap organises pile-cap geometry, loads and reinforcement inputs. Depending on the module version, workflows include compression and tension inputs, concrete and steel properties, thickness and shear checks, moment reinforcement, development/STM review, estimates, and plan/section drawings. Compact interfaces help organise these inputs on laptop displays.'],
    bn: ['Pile cap geometry ও reinforcement', 'NBPileCap-এ pile-cap geometry, load ও reinforcement input সাজানো থাকে। Module version অনুযায়ী compression/tension input, concrete ও steel properties, thickness ও shear check, moment reinforcement, development/STM review, estimate এবং plan/section drawing workflow পাওয়া যায়। Laptop display-এ কাজের সুবিধার জন্য compact interface রয়েছে।'],
  },
  {
    en: ['Slab, beam, grid and room measurement', 'NBSlabDraw helps automate main, crank and extra reinforcement, support detection, block reading, hooks, bends and legend dimensions. Beam, grade-beam, column and grid modules support related drawing and layout tasks. NBRM adds room names and architectural feet-and-inch measurements, such as a bedroom measuring 15′-10″ × 8′-11″.'],
    bn: ['Slab, beam, grid ও room measurement', 'NBSlabDraw main rod, crank rod, extra rod, support detection, block reading, hook/bend ও legend dimension-এর পুনরাবৃত্ত কাজ সহজ করে। Beam, grade beam, column ও grid module দিয়ে সংশ্লিষ্ট drawing ও layout তৈরি করা যায়। NBRM room name এবং architectural feet-inch measurement বসাতে সাহায্য করে—যেমন একটি bedroom-এর মাপ 15′-10″ × 8′-11″।'],
  },
];

export function ToolsArticle({ locale }: { locale: Locale }) {
  return (
    <div className="mt-10 space-y-8">
      {sections.map((section) => {
        const [title, body] = section[locale];
        return <section key={section.en[0]}>
          <h2 className="text-[length:var(--step-h2)] font-bold text-navy">{title}</h2>
          <p className="mt-3 leading-relaxed text-muted">{body}</p>
        </section>;
      })}
    </div>
  );
}

export function ToolsPurchasePolicies({ locale }: { locale: Locale }) {
  const en = locale === 'en';
  return <section className="mt-12">
    <h2 className="text-[length:var(--step-h2)] font-bold text-navy">{en ? 'Activation, credits and updates' : 'Activation, credits ও updates'}</h2>
    <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">
      <p>{en ? 'Activation permits use on the licensed machine. Tokens are separate usage credits for paid operations; an active licence may still require a token refill. Custom refill amounts are subject to vendor approval.' : 'Activation নির্দিষ্ট machine-এ software ব্যবহারের অনুমতি দেয়। Token হলো paid operation-এর আলাদা usage credit; active licence থাকলেও token refill লাগতে পারে। Custom refill amount vendor approval-এর ভিত্তিতে দেওয়া হয়।'}</p>
      <p>{en ? 'Check your Machine ID and License ID before purchasing a refill. Under the product policy, a valid refill that has been issued and successfully applied is generally non-refundable. Replacing a refill issued against incorrect information requires vendor verification.' : 'Refill কেনার আগে Machine ID ও License ID যাচাই করুন। Product policy অনুযায়ী valid refill issue ও successfully apply হয়ে গেলে সাধারণত তা refundable নয়। ভুল তথ্য দিয়ে issue করা refill replacement-এর জন্য vendor verification প্রয়োজন।'}</p>
      <p>{en ? 'Moving to another computer or changing major hardware may change the Machine ID. Activation and remaining-credit transfers require verification of identity, the previous licence and purchase records; they are not automatic.' : 'Computer পরিবর্তন বা বড় hardware change-এ Machine ID বদলে যেতে পারে। Activation ও remaining credit transfer-এর জন্য customer identity, আগের licence এবং purchase record যাচাই প্রয়োজন; transfer automatic নয়।'}</p>
      <p>{en ? 'Updates may improve the interface, engineering workflows, security and compatibility. Major releases, additional AutoCAD version support or significant new modules may require a paid upgrade.' : 'Update-এ interface, engineering workflow, security ও compatibility উন্নত হতে পারে। Major release, নতুন AutoCAD version support বা বড় নতুন module-এর জন্য paid upgrade লাগতে পারে।'}</p>
    </div>
  </section>;
}
