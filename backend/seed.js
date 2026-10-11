const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./src/models/User');
const Event = require('./src/models/Event');
const Gallery = require('./src/models/Gallery');
const Carousel = require('./src/models/Carousel');
const Notification = require('./src/models/Notification');

const adminEmail = 'zibeke@outlook.com';
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
        $set: {
          name: account.name,
          role: account.role,
          passwordHash,
          authProvider: 'local'
        },
        $setOnInsert: { email: account.email }
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
