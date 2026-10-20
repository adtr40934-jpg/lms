const User = require('../models/User');
const Course = require('../models/Course');
const Order = require('../models/Order');
const Enrollment = require('../models/Enrollment');
const Message = require('../models/Message');

// GET /api/admin/dashboard
exports.stats = async (req, res) => {
    try {
        const [students, courses, pendingOrders, messages, enrollments] = await Promise.all([
            User.countDocuments({ role: 'student' }),
            Course.countDocuments(),
            Order.countDocuments({ status: 'pending' }),
            Message.countDocuments({ is_read: false }),
            Order.aggregate([
                { $match: { status: 'approved' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        const revenue = enrollments[0]?.total || 0;

        // recent orders
        const recentOrders = await Order.find()
            .populate('course', 'title')
            .sort({ _id: -1 }).limit(5).lean();

        // recent students
        const recentStudents = await User.find({ role: 'student' })
            .select('name email created_at').sort({ _id: -1 }).limit(5).lean();

        // top courses by enrollments
        const topCourses = await Enrollment.aggregate([
            { $group: { _id: '$course', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'course' } },
            { $unwind: '$course' },
            { $project: { title: '$course.title', count: 1 } }
        ]);

        // chart data: last 7 days revenue & new students
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const revenueByDayRaw = await Order.aggregate([
            { $match: { status: 'approved', created_at: { $gte: sevenDaysAgo } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: "Africa/Cairo" } },
                revenue: { $sum: '$amount' },
                orders: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
        ]);

        const studentsByDayRaw = await User.aggregate([
            { $match: { role: 'student', created_at: { $gte: sevenDaysAgo } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: "Africa/Cairo" } },
                students: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
        ]);

        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' }); // YYYY-MM-DD
            
            const revData = revenueByDayRaw.find(r => r._id === dateStr);
            const stuData = studentsByDayRaw.find(s => s._id === dateStr);
            
            chartData.push({
                name: d.toLocaleDateString('ar-EG', { weekday: 'short', timeZone: 'Africa/Cairo' }),
                revenue: revData ? revData.revenue : 0,
                orders: revData ? revData.orders : 0,
                students: stuData ? stuData.students : 0
            });
        }

        res.json({
            stats: { students, courses, pendingOrders, revenue, unreadMessages: messages },
            liveStats: global.liveStats,
            recentOrders, recentStudents, topCourses, chartData
        });
    } catch (err) {
        res.status(500).json({ message: 'حدث خطأ' });
    }
};
