const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const Event = require('./src/models/Event');
const Gallery = require('./src/models/Gallery');
const Carousel = require('./src/models/Carousel');
const Notification = require('./src/models/Notification');
const ChatMessage = require('./src/models/ChatMessage');
const Conversation = require('./src/models/Conversation');

const adminEmail = 'zibeke@outlook.com';
const bpoArticle = `Business Process Outsourcing (BPO) is not new. In the 1980s and 1990s, companies began outsourcing their back-office functions like payroll processing, accounting and data entry to a third-party provider.

This allowed them to reduce operational costs and focus on their core business while still receiving the services they needed to operate.

As little as 10 years ago, the Business Process Outsourcing (BPO) industry was viewed as a lever for cost reduction and operational efficiency, where call centres and back-office support were outsourced.

Automation was, by today's standards, fairly basic, and client expectations were for low-cost standardised services. This led to varied customer experiences and some less-than-optimal outcomes for the customer.

Regrettably, the hangover from that time is a degree of reluctance by customers to engage with contact centres. However, the BPO industry has evolved far beyond those humble origins.

### The industry has evolved

The sector is booming - globally, the [BPO market](https://aamn.africa/the-future-of-bpo-in-africa-a-new-frontier-for-global-outsourcing/) was valued at more than $285.76 billion in 2024 and is projected to reach over $544 billion by 2032. From a starting point of cost reduction and operational efficiency, today the BPO industry is about strategic value creation, customer experience and innovation.

This evolution hasn't happened by chance. As the sector has grown, BPO has adapted significantly to meet new client needs and embrace the advances that new technologies have offered.

As the industry has become more sophisticated, BPO providers have become strategic business partners to their clients.

Whereas previously BPO companies were seen as merely the delegated third-party service providers that handled non-core business functions, the sector now encompasses a wide range of services including customer service, IT support, finance, human resources and accounting.

It even provides specialised services and solutions to industries with specific sectoral and regulatory requirements, like healthcare, insurance and financial services. And, by using data-driven insights derived from customer interactions, BPO organisations' clients have an effective tool to improve their customer satisfaction and make strategic decisions about products and services.

### Technology has influenced the evolution of BPO

Technology is increasingly playing a pivotal role in transforming the BPO landscape. Artificial Intelligence (AI) is the talk of the proverbial town currently, but this is by no means the first technology to disrupt the BPO sector.

Changing consumer behaviour and the expectation of 24/7 support, along with a drive towards self-service, marked a critical shift in the industry, with the introduction of chatbots, robotic process automation (RPA) and various iterations of machine learning. This resulted in the industry refocusing away from the low-value work that is easy to automate.

Technology innovation is enhancing service delivery and improving efficiency, moving the sector towards being tech-enabled service providers. Now, the bulk of interactions managed by call centres are high-emotion, high-complexity customer engagements where the human factor is a key distinguishing feature in the success of the interaction.

Emotionally intelligent agents are indispensable, bringing a nuanced understanding of customer sentiment that results in a service that exceeds expectations and leaves a lasting positive impact on the overall customer experience.

Technology, and specifically AI, is transforming the way knowledge is managed and used in contact centres.

AI is helping human agents deliver high-value services to customers who need a more complex and emotionally sensitive or nuanced interaction, with LLMs helping these agents almost instantly find the best match or answer to a query, and providing real-time, contextually aware AI translation capabilities and live transcription on calls.

With AI as an enabling technology embedded in the industry, this is dramatically increasing the value and quality of customer engagements.

### Africa is becoming an industry leader

Africa, once an insignificant player, now commands growing attention due to its young, educated, multilingual, and tech-savvy workforce, with over 60% of the population under 25. In 2025, [Africa's BPO](https://www.statista.com/outlook/tmo/it-services/business-process-outsourcing/africa) market is forecasted to reach $7.15 billion, with a projected CAGR of 5.66%, reaching $9.42 billion by 2030.

South Africa is leading the charge on the continent, followed by Nigeria, Kenya, Egypt, and Ghana, with each country developing robust infrastructure and policy frameworks to attract global contracts.

Government-backed initiatives such as tax incentives and infrastructure investments, along with business-friendly strategic policies, are helping to drive the boom.

Africa offers a large pool of English-speaking professionals, with increasing specialisation in tech and customer experience, while ongoing investments into digital infrastructure such as fibre-optic networks and cloud services have enabled seamless service delivery. The integration of advanced technologies such as AI and automation into BPO services enhances operations and enables faster and more accurate processing of tasks. That, combined with the cost advantages of outsourcing to Africa, will help the industry grow while allowing companies to allocate resources more efficiently.

### The next evolution of the BPO sector will be driven by value, digital innovation and strategic partnerships

The transformation of the BPO industry from its origins as a cost-saving mechanism to its current role as a driver of innovation and strategic value underscores the sector's ongoing relevance in an ever-evolving global marketplace.

As Africa rises to prominence and technological advances redefine service delivery, businesses that embrace these changes will be best positioned to thrive.

The journey of BPO is a story of continual adaptation, where those willing to innovate and invest in talent will shape the future of customer experience and operational excellence.

Africa is emerging as a formidable player in the global industry - with its skilled workforce and a diverse talent pool, the quality of services offered by BPO companies on the continent will continue to attract investment.

**#CCI #WomenInLeadership #HumanConnections #Business Results**`;
const accounts = [
  { name: 'liyema zibeke', email: adminEmail, role: 'admin' },
  { name: 'onwabe zibeke', email: 'onwabe@outlook.com', role: 'user' },
  { name: 'bandile mdluli', email: 'bandile@outlook.com', role: 'user' }
];

async function seedDatabase() {
  const passwordHash = await bcrypt.hash('Password123', 12);
  const legacyAccounts = [
    ['zibekeliyema@outlook.com', adminEmail],
    ['zibekeonwabe@outlook.com', 'onwabe@outlook.com'],
    ['bandilemdluli@outlook.com', 'bandile@outlook.com']
  ];
  for (const [legacyEmail, currentEmail] of legacyAccounts) {
    const legacyAccount = await User.findOne({ email: legacyEmail });
    const currentAccount = await User.findOne({ email: currentEmail });
    if (legacyAccount && !currentAccount) {
      legacyAccount.email = currentEmail;
      await legacyAccount.save();
    }
  }
  const users = {};
  for (const account of accounts) {
    users[account.email] = await User.findOneAndUpdate(
      { email: account.email },
      {
        $setOnInsert: {
          name: account.name,
          email: account.email,
          role: account.role,
          passwordHash,
          authProvider: 'local'
        }
      },
      { upsert: true, new: true, runValidators: true }
    );
  }

  const admin = users[adminEmail];
  const eventSeeds = [
    {
      key: 'careerbox-feature',
      title: 'Peter Andrew: How BPO has Evolved - A Transformation...',
      description: 'Business Process Outsourcing (BPO) is not new. In the 1980s and 1990s, companies...',
      image: 'https://connect.cci-digital.cloud/wp-content/uploads/2026/02/Header_20copy.webp',
      hashtags: ['#PeopleFirst', '#CareerBox']
    },
    {
      key: 'champions-feature',
      title: 'Change of Date: Dinner of Champions Quarterly Awards',
      description: 'Discover the work, energy and perspectives across CCI.',
      image: 'https://connect.cci-digital.cloud/wp-content/uploads/2026/09/12943254269_Design_Emailer_Dinner-of-Champions-September-Teaser_2026_09_23_vs02-scaled.webp',
      hashtags: ['#PeopleFirst', '#LifeAtCCI']
    },
    {
      key: 'growth-feature',
      title: 'Peter’s Post: Growth - Building Momentum Together in 2026',
      description: 'As we step into a new year, we celebrate growth – in our people...',
      image: 'https://connect.cci-digital.cloud/wp-content/uploads/2026/02/Posters_Post_January_2026_01_27_vs01-01.webp',
      hashtags: ['#CareerBox', '#CCICommunity']
    },
    {
      key: 'heritage-video',
      title: 'Heritage Day Cook-Off',
      description: '',
      videoUrl: 'https://connect.cci-digital.cloud/wp-content/uploads/2026/09/2026_09_18_12818236186_CCI-Heritage-Day-Cook-Off_V2_Connect.mp4',
      type: 'video',
      hashtags: ['#CCICommunity', '#LifeAtCCI']
    }
  ];
  const seededEvents = {};
  for (const seed of eventSeeds) {
    const event = await Event.findOneAndUpdate(
      { seedKey: seed.key },
      {
        $setOnInsert: {
          title: seed.title,
          description: seed.description,
          image: seed.image || '',
          videoUrl: seed.videoUrl || '',
          type: seed.type || 'event',
          createdBy: admin._id,
          hashtags: seed.hashtags,
          seedKey: seed.key
        }
      },
      { upsert: true, new: true, runValidators: true }
    );
    seededEvents[seed.key] = event;
  }
  await Event.updateOne(
    { seedKey: 'careerbox-feature' },
    { $set: { description: bpoArticle, hashtags: ['#CCI', '#WomenInLeadership', '#HumanConnections', '#Business Results'] } },
    { runValidators: true }
  );

  const carouselSeeds = [
    ...eventSeeds.map((seed) => ({
      itemType: seed.type === 'video' ? 'video' : 'event',
      itemId: seededEvents[seed.key]._id,
      heading: seed.type === 'video' ? '' : seed.title,
      image: seed.image || '',
      videoUrl: seed.videoUrl || '',
      descriptionSnippet: seed.type === 'video' ? '' : seed.description
    }))
  ];
  for (const slide of carouselSeeds) {
    await Carousel.updateOne(
      { itemId: slide.itemId },
      { $setOnInsert: slide },
      { upsert: true }
    );
  }
  const carouselIds = (await Carousel.find().sort({ createdAt: -1 }).select('_id').limit(4)).map((item) => item._id);
  await Carousel.deleteMany({ _id: { $nin: carouselIds } });

  const albums = [
    {
      heading: 'Dinner of Champions',
      carouselImage: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=85',
      galleryImages: [
        'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=85',
        'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=85',
        'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=85'
      ]
    },
    {
      heading: 'Heritage Day Cook-Off',
      carouselImage: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=85',
      galleryImages: [
        'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=85',
        'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=85',
        'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1200&q=85'
      ]
    },
    {
      heading: 'People of CCI',
      carouselImage: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=85',
      galleryImages: [
        'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85',
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=85',
        'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85'
      ]
    },
    {
      heading: 'Community Impact',
      carouselImage: 'https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?auto=format&fit=crop&w=900&q=85',
      galleryImages: [
        'https://images.unsplash.com/photo-1531206715517-5c0ba140b2b8?auto=format&fit=crop&w=1200&q=85',
        'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=1200&q=85',
        'https://images.unsplash.com/photo-1509099836639-18ba1795216d?auto=format&fit=crop&w=1200&q=85'
      ]
    }
  ];
  for (const album of albums) {
    await Gallery.updateOne(
      { heading: album.heading, createdBy: admin._id },
      { $setOnInsert: { ...album, createdBy: admin._id } },
      { upsert: true }
    );
  }

  const notificationSeeds = [
    {
      type: 'comment',
      title: 'Bandile Bandile',
      message: 'commented on Dinner of Champions.',
      relatedId: seededEvents['champions-feature']._id
    },
    {
      type: 'gallery',
      title: 'New photos',
      message: 'New photos from Heritage Day Cook-Off are available.'
    },
    {
      type: 'upcoming',
      title: 'Community Career Day',
      message: 'is coming up in Johannesburg.'
    },
    { type: 'hashtag', title: '#PeopleFirst', message: 'Popular community tag.' },
    { type: 'hashtag', title: '#CareerBox', message: 'Popular community tag.' },
    { type: 'hashtag', title: '#CCICommunity', message: 'Popular community tag.' },
    { type: 'hashtag', title: '#LifeAtCCI', message: 'Popular community tag.' }
  ];
  for (const item of notificationSeeds) {
    await Notification.updateOne(
      { type: item.type, title: item.title, message: item.message },
      { $setOnInsert: { ...item, forAllUsers: true } },
      { upsert: true }
    );
  }

  const upcomingEvents = [
    { title: 'Community Career Day', startsAt: new Date('2026-12-03T09:00:00'), location: 'Umhlanga · 09:00' },
    { title: 'Quarterly Town Hall', startsAt: new Date('2026-12-18T14:00:00'), location: 'Umhlanga · 14:00' }
  ];
  for (const upcoming of upcomingEvents) {
    await Event.updateOne(
      { seedKey: `upcoming:${upcoming.title}` },
      {
        $setOnInsert: {
          ...upcoming,
          title: upcoming.title,
          description: '',
          type: 'event',
          isUpcoming: true,
          createdBy: admin._id,
          seedKey: `upcoming:${upcoming.title}`
        }
      },
      { upsert: true, runValidators: true }
    );
  }

  const chatSeeds = [
    {
      participants: [users['onwabe@outlook.com'], users['bandile@outlook.com']],
      messages: [
        {
          sender: 'onwabe@outlook.com',
          receiver: 'bandile@outlook.com',
          message: 'Hi Bandile, are you joining the Community Career Day planning chat?',
          createdAt: new Date('2026-10-12T08:30:00Z')
        },
        {
          sender: 'bandile@outlook.com',
          receiver: 'onwabe@outlook.com',
          message: "Yes, I'll be there. I'll share the event details this afternoon.",
          createdAt: new Date('2026-10-12T09:02:00Z')
        }
      ]
    },
    {
      participants: [admin, users['onwabe@outlook.com']],
      messages: [
        {
          sender: adminEmail,
          receiver: 'onwabe@outlook.com',
          message: 'Welcome to CCI Connect! You can find the latest events and updates on the Events page.',
          createdAt: new Date('2026-10-11T11:15:00Z')
        },
        {
          sender: 'onwabe@outlook.com',
          receiver: adminEmail,
          message: 'Thanks! I found the gallery too.',
          createdAt: new Date('2026-10-12T10:20:00Z')
        }
      ]
    },
    {
      participants: [admin, users['bandile@outlook.com']],
      messages: [
        {
          sender: adminEmail,
          receiver: 'bandile@outlook.com',
          message: 'Hi Bandile, the Heritage Day Cook-Off photos are in the Gallery.',
          createdAt: new Date('2026-10-11T13:40:00Z')
        },
        {
          sender: 'bandile@outlook.com',
          receiver: adminEmail,
          message: 'Great, thanks for sharing them.',
          createdAt: new Date('2026-10-12T12:05:00Z')
        }
      ]
    }
  ];
  for (const chat of chatSeeds) {
    for (const message of chat.messages) {
      const sender = users[message.sender];
      const receiver = users[message.receiver];
      await ChatMessage.findOneAndUpdate(
        {
          senderId: sender._id,
          receiverId: receiver._id,
          message: message.message,
          createdAt: message.createdAt
        },
        {
          $setOnInsert: {
            senderId: sender._id,
            receiverId: receiver._id,
            message: message.message,
            status: 'read',
            createdAt: message.createdAt
          }
        },
        { upsert: true, runValidators: true }
      );
    }

    const existingConversation = await Conversation.findOne({
      participants: { $all: chat.participants.map((participant) => participant._id), $size: 2 }
    });
    if (!existingConversation) {
      await Conversation.create({
        participants: chat.participants.map((participant) => participant._id),
        lastMessageAt: chat.messages[chat.messages.length - 1].createdAt
      });
    }
  }
}

if (require.main === module) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cci-community-portal')
    .then(seedDatabase)
    .then(() => mongoose.disconnect())
    .then(() => console.log('CCI seed data is ready.'))
    .catch((error) => {
      console.error('CCI seed failed:', error);
      process.exitCode = 1;
    });
}

module.exports = { seedDatabase };
