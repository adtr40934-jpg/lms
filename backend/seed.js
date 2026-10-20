const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Course = require('./src/models/Course');
const Category = require('./src/models/Category');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB');

  // Add a category
  let category = await Category.findOne({ slug: 'marketing' });
  if (!category) {
    category = await Category.create({
      name: 'التسويق الشامل',
      slug: 'marketing',
      icon: 'fa-solid fa-bullseye',
      sort_order: 1
    });
  }

  // Add a course
  const course = await Course.create({
    title: 'كورس إعلانات السوشيال ميديا الاحترافي',
    slug: 'social-media-ads-pro',
    short_desc: 'تعلم كيفية إطلاق وإدارة حملات إعلانية ناجحة على فيسبوك وانستجرام وتيك توك من الصفر وحتى الاحتراف.',
    description: 'في هذا الكورس الشامل، ستتعلم أسرار الإعلانات الممولة وكيفية استهداف الجمهور الصحيح، بالإضافة إلى تحليل البيانات لتحقيق أفضل عائد على الاستثمار (ROAS).',
    price: 1500,
    old_price: 2500,
    level: 'متوسط',
    duration: '15 ساعة',
    categories: [category._id],
    is_published: true,
    thumbnail: ''
  });

  console.log('Course created:', course.title);
  process.exit();
}).catch(err => {
  console.error(err);
  process.exit(1);
});
