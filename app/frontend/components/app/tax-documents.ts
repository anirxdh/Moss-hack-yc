// US tax-filing document taxonomy for the upload step.
// CORE_DOCS are shown by default; OPTIONAL_CATEGORIES expand on demand.

export interface TaxDoc {
  id: string;
  code: string; // form code, shown in mono (e.g. "W-2", "1099-INT")
  name: string; // plain-language name
  desc: string; // one-line hint
}

export interface DocCategory {
  id: string;
  icon: string; // emoji marker
  name: string;
  blurb: string;
  docs: TaxDoc[];
}

export const CORE_DOCS: TaxDoc[] = [
  { id: 'w2', code: 'W-2', name: 'Wages & salary', desc: 'One from each employer you worked for.' },
  {
    id: '1099nec',
    code: '1099-NEC',
    name: 'Freelance / contractor income',
    desc: 'Self-employment, gig, or 1099-MISC work.',
  },
  {
    id: '1099int',
    code: '1099-INT',
    name: 'Interest income',
    desc: 'From banks and savings accounts.',
  },
  {
    id: '1099div',
    code: '1099-DIV',
    name: 'Dividends',
    desc: 'From stocks, funds, and brokerages.',
  },
  {
    id: '1099b',
    code: '1099-B',
    name: 'Investment sales',
    desc: 'Stocks or crypto sold — capital gains/losses.',
  },
  {
    id: 'prior',
    code: '1040',
    name: "Last year's return",
    desc: 'Helps carry over prior-year details.',
  },
];

export const OPTIONAL_CATEGORIES: DocCategory[] = [
  {
    id: 'home',
    icon: '🏠',
    name: 'Home & deductions',
    blurb: 'Mortgage, property, and giving.',
    docs: [
      {
        id: '1098',
        code: '1098',
        name: 'Mortgage interest',
        desc: 'Interest paid on your home loan.',
      },
      {
        id: 'proptax',
        code: 'PROP TAX',
        name: 'Property tax',
        desc: 'Real-estate tax statements.',
      },
      {
        id: 'charity',
        code: 'DONATIONS',
        name: 'Charitable giving',
        desc: 'Receipts for donations made.',
      },
      {
        id: 'salt',
        code: 'SALT',
        name: 'State & local tax',
        desc: 'State income or sales tax paid.',
      },
    ],
  },
  {
    id: 'education',
    icon: '🎓',
    name: 'Education',
    blurb: 'Tuition and student loans.',
    docs: [
      { id: '1098t', code: '1098-T', name: 'Tuition', desc: 'Qualified education expenses.' },
      {
        id: '1098e',
        code: '1098-E',
        name: 'Student-loan interest',
        desc: 'Interest paid on student loans.',
      },
    ],
  },
  {
    id: 'health',
    icon: '🏥',
    name: 'Health & HSA',
    blurb: 'Coverage and health savings.',
    docs: [
      {
        id: '1095',
        code: '1095-A/B/C',
        name: 'Health coverage',
        desc: 'Marketplace or employer coverage.',
      },
      {
        id: '1099sa',
        code: '1099-SA',
        name: 'HSA distributions',
        desc: 'Money taken from an HSA.',
      },
      { id: '5498sa', code: '5498-SA', name: 'HSA contributions', desc: 'Money put into an HSA.' },
    ],
  },
  {
    id: 'retirement',
    icon: '🧓',
    name: 'Retirement & benefits',
    blurb: 'Distributions and government income.',
    docs: [
      {
        id: '1099r',
        code: '1099-R',
        name: 'Retirement distributions',
        desc: 'IRA, 401(k), or pension payouts.',
      },
      {
        id: 'ssa',
        code: 'SSA-1099',
        name: 'Social Security',
        desc: 'Social Security benefits received.',
      },
      {
        id: '1099g',
        code: '1099-G',
        name: 'Unemployment / refund',
        desc: 'Unemployment or state tax refund.',
      },
    ],
  },
  {
    id: 'business',
    icon: '💼',
    name: 'Business & rental',
    blurb: 'Side business and property income.',
    docs: [
      { id: '1099k', code: '1099-K', name: 'Payment apps', desc: 'Card and marketplace payouts.' },
      {
        id: 'schedc',
        code: 'SCH C',
        name: 'Business expenses',
        desc: 'Costs for your self-employment.',
      },
      { id: 'schede', code: 'SCH E', name: 'Rental income', desc: 'Rent collected and expenses.' },
      {
        id: 'k1',
        code: 'K-1',
        name: 'Partnership / S-corp',
        desc: 'Income from a pass-through entity.',
      },
    ],
  },
  {
    id: 'family',
    icon: '👶',
    name: 'Family & other',
    blurb: 'Dependents and contributions.',
    docs: [
      {
        id: '2441',
        code: 'FORM 2441',
        name: 'Childcare expenses',
        desc: 'Daycare or dependent care costs.',
      },
      {
        id: '5498',
        code: '5498',
        name: 'IRA contributions',
        desc: 'Traditional or Roth IRA deposits.',
      },
    ],
  },
];
