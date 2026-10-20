const Subscription = require('../models/Subscription');

exports.createSubscription = async (req, res) => {
    try {
        const { courseId, paymentMethod, amount, senderPhone, fullName, email, phone } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'Proof image is required' });
        }

        // The file path saved in the DB should be accessible via static route, e.g., /uploads/filename.jpg
        const proofImageUrl = `/uploads/${req.file.filename}`;

        const newSubscription = new Subscription({
            courseId,
            fullName,
            phone,
            email,
            paymentMethod,
            amount: Number(amount),
            senderPhone,
            proofImage: proofImageUrl
        });

        await newSubscription.save();

        res.status(201).json({
            success: true,
            message: 'Subscription submitted successfully',
            subscriptionId: newSubscription._id
        });

    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({ message: 'Server Error. Could not submit subscription.' });
    }
};
