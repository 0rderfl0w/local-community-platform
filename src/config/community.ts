export const communityConfig = {
  name: 'Braga AI Builders',
  city: 'Braga',
  locale: 'en-GB',
  timeZone: 'Europe/Lisbon',
  timeZoneLabel: 'Braga time',
  tagline: 'A local AI community',
  description: 'A Braga community for people using AI to solve real problems, build useful things, and help each other move faster.',
  whatsappUrl: 'https://chat.whatsapp.com/GwhqmjtwcPT4vVmQmqqIRW',
  githubUrl: 'https://github.com/richkapp/local-community-platform',
  legal: {
    operatorName: 'Braga AI Builders community organizers',
    country: 'Portugal',
    governingLaw: 'Portuguese law',
    privacyFrameworkName: 'General Data Protection Regulation',
    privacyFrameworkShortName: 'GDPR',
    privacyFrameworkUrl: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng',
    dataProtectionAuthorityName: 'Comissão Nacional de Proteção de Dados (CNPD)',
    dataProtectionAuthorityUrl: 'https://www.cnpd.pt/cidadaos/participacoes/'
  },
  home: {
    eyebrow: 'A local AI community in Braga',
    heroTitle: 'Curious about AI? Come meet your people.',
    heroBody: 'Meet Braga locals using AI to solve real problems, build useful things, and help each other move faster.',
    heroImage: {
      src: '',
      alt: '',
      credit: '',
      creditUrl: ''
    },
    experienceTitle: 'You do not need to be advanced.',
    experienceAccent: 'You need to be curious.',
    experienceRange: [
      'Researching, drafting, and planning with AI',
      'Using AI to work smarter every day',
      'Building products, workflows, and automations',
      'Running a business with teams of AI agents'
    ],
    experienceFooter: 'If you actively use AI and want to understand it better, you belong here.',
    memoryTitle: 'The chat is the conversation. This site is the memory.',
    memoryBody: 'Good ideas vanish in a busy chat. Here they stay useful, searchable, and able to shape what happens next.',
    postsBody: 'Share an idea, resource, or perspective before the chat moves on.',
    eventsBody: 'Turn shared interests into meetups and build the connection in person.',
    membersBody: 'Meet the people behind the posts and find experience that complements your own.',
    membershipImage: {
      src: '',
      alt: '',
      credit: '',
      creditUrl: ''
    },
    membershipTitle: 'A profile when you want one.',
    membershipBody: 'Invited members can sign in without a password to manage posts, use their name when it helps, and choose whether to appear in the directory.',
    closingStatement: 'Use AI. Share what works. Meet others doing the same.',
    closingBody: 'The next community conversation is one click away.'
  }
} as const;

export const communityPageTitle = (page?: string) => page ? `${page} · ${communityConfig.name}` : communityConfig.name;
