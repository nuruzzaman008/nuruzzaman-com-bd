import Link from 'next/link';

import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { localizePath, type Locale } from '@/lib/i18n/locale';

/**
 * The NB Engineering Tools article, section by section: what the software is,
 * its main workflows, how licences and NB Credits work, and installation.
 *
 * Adapted from the owner's "NB Engineering Tools for AutoCAD" document. Each
 * subject is written once, here; the FAQ, the price guide and the product
 * listing point back to it rather than saying it again.
 */

type Copy = { bn: string; en: string };

const say = (copy: Copy, locale: Locale) => (locale === 'en' ? copy.en : copy.bn);

const H2 = 'text-[length:var(--step-h2)] font-bold text-navy';
const SECTION = 'mt-12 scroll-mt-24';

export function ToolsOverview({ locale }: { locale: Locale }) {
  const audience: Copy[] = [
    { bn: 'Structural ও civil engineer', en: 'Structural and civil engineers' },
    {
      bn: 'Engineering consultant ও structural design office',
      en: 'Engineering consultants and structural design offices',
    },
    { bn: 'AutoCAD drafting professional', en: 'AutoCAD drafting professionals' },
    { bn: 'Foundation design-এ কাজ করা প্রকৌশলী', en: 'Engineers working on foundation design' },
    {
      bn: 'ছোট ও মাঝারি engineering consultancy',
      en: 'Small and medium engineering consultancies',
    },
  ];

  return (
    <section id="overview" className={SECTION}>
      <h2 className={H2}>
        {say({ bn: 'NB Engineering Tools কী', en: 'What NB Engineering Tools is' }, locale)}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-muted">
        <p>
          {say(
            {
              bn: 'NB Engineering Tools হলো AutoCAD-এর জন্য তৈরি একটি professional engineering productivity ও automation suite। Structural drawing, foundation design, reinforcement detailing, quantity estimate ও layout preparation-এর মতো পুনরাবৃত্ত AutoCAD কাজ এক জায়গা থেকে দ্রুত করা যায়।',
              en: 'NB Engineering Tools is a professional engineering productivity and automation suite for AutoCAD. It speeds up repetitive AutoCAD work - structural drawing, foundation design, reinforcement detailing, quantity estimates and layout preparation - from one place.',
            },
            locale,
          )}
        </p>
        <p>
          {say(
            {
              bn: 'এটি আলগা LSP ফাইলের সংগ্রহ নয়। ২৫টি engineering/productivity মডিউল ও ১টি core/security মডিউল — মোট ২৬টি — protected compiled VLX হিসেবে আসে, সাথে professional Windows installer, AutoCAD Ribbon, classic pull-down menu, machine activation ও NB Credit ব্যবস্থা। কোনো LSP হাতে load করতে হয় না।',
              en: 'It is not a collection of loose LSP files. 25 engineering/productivity modules and 1 core/security module - 26 in all - ship as protected compiled VLX, with a professional Windows installer, an AutoCAD Ribbon, a classic pull-down menu, machine activation and NB Credits. Nothing has to be loaded by hand.',
            },
            locale,
          )}
        </p>
      </div>
      <h3 className="mt-6 font-bold text-navy">
        {say({ bn: 'কাদের জন্য', en: 'Who it is for' }, locale)}
      </h3>
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {audience.map((item) => (
          <li key={item.en} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-teal" />
            <span>{say(item, locale)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ToolsWorkflows({ locale }: { locale: Locale }) {
  const workflows: { title: Copy; body: Copy }[] = [
    {
      title: {
        bn: 'Footing design থেকে reinforcement, drawing ও estimate',
        en: 'Footing design, reinforcement, drawing and estimate',
      },
      body: {
        bn: 'NBFooting-এ footing selection, unique design grouping, structural input, design summary, reinforcement, plan/section drawing ও estimate এক workflow-তে থাকে। একই রকম footing-গুলো একটি unique design group-এ আসে — যেমন ২৪টি footing নির্বাচন করলে যদি ২টি unique design হয়, credit কাটে ২টি সফল design-এর, ২৪টির নয়। Combined footing-এর জন্য আছে NBCombinedFooting।',
        en: 'NBFooting brings footing selection, unique design grouping, structural inputs, the design summary, reinforcement, plan and section drawings and the estimate into one workflow. Identical footings fall into one unique design group - select 24 footings that resolve to 2 unique designs and credits are charged for the 2 successful designs, not 24. NBCombinedFooting handles combined footings.',
      },
    },
    {
      title: { bn: 'Pile cap geometry ও reinforcement', en: 'Pile cap geometry and reinforcement' },
      body: {
        bn: 'NBPileCap-এ pile-cap geometry, load ও reinforcement input সাজানো থাকে। Module version অনুযায়ী compression/tension input, concrete ও steel properties, thickness ও shear check, moment reinforcement, development/STM review, estimate এবং plan/section drawing workflow পাওয়া যায়। Laptop display-এর জন্য compact interface আছে।',
        en: 'NBPileCap organises pile-cap geometry, loads and reinforcement inputs. Depending on the module version, it covers compression and tension inputs, concrete and steel properties, thickness and shear checks, moment reinforcement, development/STM review, the estimate and plan/section drawings, with a compact interface for laptop displays.',
      },
    },
    {
      title: {
        bn: 'Slab, beam, grid ও room measurement',
        en: 'Slab, beam, grid and room measurement',
      },
      body: {
        bn: 'NBSlabDraw main rod, crank rod, extra rod, support detection, block reading, hook/bend ও legend dimension-এর পুনরাবৃত্ত কাজ সহজ করে। Beam, grade beam, column ও grid মডিউল দিয়ে সংশ্লিষ্ট drawing ও layout তৈরি হয়। NBRM room name ও architectural feet-inch মাপ বসায় — যেমন একটি bedroom 15′-10″ × 8′-11″।',
        en: 'NBSlabDraw takes the repetition out of main, crank and extra bars, support detection, block reading, hooks, bends and legend dimensions. The beam, grade-beam, column and grid modules produce the related drawings and layouts. NBRM adds room names and architectural feet-and-inch sizes, such as a bedroom at 15′-10″ × 8′-11″.',
      },
    },
  ];

  return (
    <section id="workflows" className={SECTION}>
      <h2 className={H2}>{say({ bn: 'প্রধান workflow', en: 'The main workflows' }, locale)}</h2>
      <div className="mt-4 space-y-6">
        {workflows.map((workflow) => (
          <div key={workflow.title.en}>
            <h3 className="font-bold text-navy">{say(workflow.title, locale)}</h3>
            <p className="mt-2 leading-relaxed text-muted">{say(workflow.body, locale)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ToolsLicensing({ locale }: { locale: Locale }) {
  const charging: Copy[] = [
    {
      bn: 'প্রতিটি টুলের credit খরচ এক নয়।',
      en: 'Tools do not all cost the same number of credits.',
    },
    {
      bn: 'কিছু টুল সফল command session অনুযায়ী charge করে।',
      en: 'Some tools charge per successful command session.',
    },
    {
      bn: 'Design টুলগুলো সফল unique design অনুযায়ী charge করে — উপরের footing উদাহরণের মতো।',
      en: 'Design tools charge per successful unique design - as in the footing example above.',
    },
    {
      bn: 'বাতিল বা ব্যর্থ operation-এ, টুলের নিয়ম অনুযায়ী, charge না-ও হতে পারে।',
      en: 'A cancelled or failed operation may not be charged, depending on the tool.',
    },
    {
      bn: 'Pack-এর সংখ্যা হলো credit balance — নির্দিষ্ট সংখ্যক drawing বা project-এর নিশ্চয়তা নয়।',
      en: 'A pack size is a credit balance, not a promise of a number of drawings or projects.',
    },
  ];

  const rules: Copy[] = [
    {
      bn: 'সঠিক Machine ID ও License ID দিয়ে refill issue ও apply হয়ে গেলে তা refund হয় না। ভুল তথ্যে issue করা refill বদলাতে ভেন্ডরের যাচাই লাগে। Custom পরিমাণের credit ভেন্ডরের অনুমোদনে issue করা যায়।',
      en: 'A refill issued and applied against the correct Machine ID and License ID is not refundable. Replacing a refill issued against wrong details needs vendor verification. Custom credit amounts can be issued with vendor approval.',
    },
    {
      bn: 'লাইসেন্স machine-bound। Computer বা motherboard বদলালে Machine ID বদলে যেতে পারে; তখন পরিচয়, আগের License ID ও ক্রয়ের রেকর্ড যাচাই করে নতুন activation দেওয়া হয় — এটি স্বয়ংক্রিয় নয়।',
      en: 'Licences are machine-bound. A new computer or motherboard can change the Machine ID; a new activation is then issued after checking identity, the previous License ID and the purchase record - it is not automatic.',
    },
    {
      bn: 'Update-এ interface, workflow, security ও compatibility উন্নত হতে পারে। Major version, নতুন AutoCAD version support বা বড় নতুন মডিউলের জন্য paid upgrade লাগতে পারে।',
      en: 'Updates may improve the interface, workflows, security and compatibility. A major version, support for a new AutoCAD release or significant new modules may be a paid upgrade.',
    },
    {
      bn: 'Activation bypass, security ব্যবস্থা পরিবর্তন, compiled ফাইল reverse engineer করা, অননুমোদিত বিতরণ বা license key বিক্রি নিষিদ্ধ; ধরা পড়লে লাইসেন্স স্থগিত বা বাতিল হতে পারে।',
      en: 'Bypassing activation, altering the security mechanism, reverse-engineering the compiled files, unauthorised redistribution and reselling licence keys are prohibited, and can lead to the licence being suspended or terminated.',
    },
  ];

  return (
    <section id="licensing" className={SECTION}>
      <h2 className={H2}>
        {say({ bn: 'লাইসেন্স ও NB Credits', en: 'Licences and NB Credits' }, locale)}
      </h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-bold text-navy">Machine activation</h3>
          <p className="mt-2 text-sm text-muted">
            {say(
              {
                bn: 'প্রতিটি সমর্থিত কম্পিউটার একটি Machine ID তৈরি করে। লাইসেন্স সেই Machine ID-র সাথে bind হয়, আর ভেন্ডর Machine ID যাচাই করে signed activation key দেন।',
                en: 'Each supported computer generates a Machine ID. The licence is bound to it, and the vendor issues a signed activation key after checking the Machine ID.',
              },
              locale,
            )}
          </p>
          <p className="font-latin mt-3 rounded-md bg-surface px-3 py-2 text-xs text-navy">
            NBM-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
          </p>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-navy">NB Credits</h3>
          <p className="mt-2 text-sm text-muted">
            {say(
              {
                bn: 'লাইসেন্স software ব্যবহারের অনুমতি দেয়; NB Credit হলো নির্দিষ্ট paid engineering operation চালানোর usage credit। AutoCAD-এর License & Tokens-এ এটি Token হিসেবে দেখায়। সক্রিয় লাইসেন্স থাকলেও paid operation-এর জন্য পর্যাপ্ত credit লাগে।',
                en: 'A licence lets you use the software; an NB Credit pays for a specific paid engineering operation. AutoCAD shows them as Tokens under License & Tokens. An active licence still needs enough credits for a paid operation.',
              },
              locale,
            )}
          </p>
        </Card>
      </div>

      <h3 className="mt-8 font-bold text-navy">
        {say({ bn: 'Credit কীভাবে কাটে', en: 'How credits are charged' }, locale)}
      </h3>
      <ul className="mt-3 list-disc space-y-1.5 ps-5 text-sm text-muted">
        {charging.map((item) => (
          <li key={item.en}>{say(item, locale)}</li>
        ))}
      </ul>

      <h3 className="mt-8 font-bold text-navy">
        {say(
          { bn: 'লাইসেন্সের সাথে 1,000 NB Credits', en: '1,000 NB Credits with a licence' },
          locale,
        )}
      </h3>
      <p className="mt-2 text-sm text-muted">
        {say(
          {
            bn: '১টি PC-র লাইসেন্সের সাথে 1,000 NB Credits দেওয়া হয়। Activation সম্পন্ন হলে admin এটি একটি refill হিসেবে issue করেন।',
            en: 'A single-PC licence comes with 1,000 NB Credits. Once activation is complete, an admin issues them as a refill.',
          },
          locale,
        )}
      </p>

      <Callout tone="warning" className="mt-6">
        <p>
          <strong>
            {say(
              { bn: 'Windows reinstall বা format:', en: 'Reinstalling or formatting Windows:' },
              locale,
            )}
          </strong>{' '}
          {say(
            {
              bn: 'স্থানীয় license ও credit ডেটা মুছে যেতে পারে; standard policy অনুযায়ী balance শূন্য হলে নতুন credit কিনতে হয়। Windows setup-এর সর্বোচ্চ ৩০ মিনিট আগে তোলা স্পষ্ট screenshot-এ balance, License ID, Machine ID ও তারিখ-সময় দেখা গেলে, ভেন্ডর যাচাইয়ের পর অবশিষ্ট balance আবার issue করা যেতে পারে। শুধু AutoCAD uninstall করলে সাধারণত activation ও credit থেকে যায়।',
              en: 'Local licence and credit data may be erased; under the standard policy, a zero balance means buying new credits. If a clear screenshot taken no more than 30 minutes before the Windows setup shows the balance, License ID, Machine ID and the date and time, the remaining balance may be reissued after vendor verification. Uninstalling only AutoCAD usually leaves the activation and credits in place.',
            },
            locale,
          )}
        </p>
        <p className="mt-2">
          <Link
            href={localizePath('/support/license-recovery', locale)}
            className="text-blue underline"
          >
            {say(
              { bn: 'বিস্তারিত শর্ত: লাইসেন্স রিকভারি', en: 'Full conditions: licence recovery' },
              locale,
            )}
          </Link>
        </p>
      </Callout>

      <h3 className="mt-8 font-bold text-navy">
        {say(
          {
            bn: 'Refill, computer বদল, update ও নিরাপত্তা',
            en: 'Refills, changing computers, updates and security',
          },
          locale,
        )}
      </h3>
      <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-relaxed text-muted">
        {rules.map((item) => (
          <li key={item.en}>{say(item, locale)}</li>
        ))}
      </ul>
    </section>
  );
}

export function ToolsInstallation({ locale }: { locale: Locale }) {
  const steps: Copy[] = [
    { bn: 'Machine ID নিন', en: 'Get your Machine ID' },
    { bn: 'লাইসেন্স কিনে activation request দিন', en: 'Buy a licence and request activation' },
    { bn: 'Signed activation key প্রয়োগ করুন', en: 'Apply the signed activation key' },
    { bn: 'প্রয়োজনে NB Credit refill নিন', en: 'Buy an NB Credit refill if you need one' },
    { bn: 'ইঞ্জিনিয়ারিং টুল ব্যবহার শুরু করুন', en: 'Start using the engineering tools' },
  ];

  return (
    <section id="installation" className={SECTION}>
      <h2 className={H2}>{say({ bn: 'ইনস্টলেশন', en: 'Installation' }, locale)}</h2>
      <p className="font-latin mt-3 rounded-[--radius-card] border border-line bg-surface px-4 py-3 text-sm text-navy">
        Welcome → System Check → License Agreement → Install → Finish
      </p>
      <p className="mt-3 text-sm text-muted">
        {say(
          {
            bn: 'Professional Windows installer দিয়ে ইনস্টল হয়; একই installer upgrade, repair ও uninstall-ও করে। ইনস্টল শেষে AutoCAD চালু করলে NB Engineering Tools Ribbon পাবেন। এরপর:',
            en: 'A professional Windows installer does the installation, and the same installer upgrades, repairs and uninstalls. Open AutoCAD afterwards and the NB Engineering Tools Ribbon is there. Then:',
          },
          locale,
        )}
      </p>
      <ol className="mt-4 space-y-2 text-sm">
        {steps.map((step, index) => (
          <li key={step.en} className="flex gap-3">
            <span className="font-latin flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-soft text-xs font-bold text-blue">
              {index + 1}
            </span>
            <span>{say(step, locale)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ToolsResponsibility({ locale }: { locale: Locale }) {
  return (
    <Callout tone="info" className="mt-10">
      <p>
        <strong>
          {say({ bn: 'ইঞ্জিনিয়ারিং দায়িত্ব:', en: 'Engineering responsibility:' }, locale)}
        </strong>{' '}
        {say(
          {
            bn: 'সফটওয়্যারটি design ও drawing automation দেয়, কিন্তু চূড়ান্ত engineering সিদ্ধান্ত, ডিজাইন যাচাই, কোড সঙ্গতি, কাঠামোগত নিরাপত্তা ও ড্রয়িংয়ের নির্ভুলতার দায়িত্ব যোগ্য প্রকৌশলীর। প্রকল্পের কোড, loading, মাটির তথ্য ও design assumption অনুযায়ী আউটপুট যাচাই না করে কোনো স্বয়ংক্রিয় ফলাফল চূড়ান্ত নির্মাণ-সিদ্ধান্তে ব্যবহার করা উচিত নয়।',
            en: 'The software automates design and drawing, but the final engineering decision, design verification, code compliance, structural safety and drawing accuracy remain the responsibility of a qualified engineer. No automated result should reach a construction decision without being checked against the project’s code, loading, soil information and design assumptions.',
          },
          locale,
        )}
      </p>
    </Callout>
  );
}
