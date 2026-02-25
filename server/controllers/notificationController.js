import Notification from "../models/Notification.js";

// Get My Notifications
export const getMyNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user.id })
            .sort({ createdAt: -1 });

        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Mark As Read
export const markAsRead = async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, {
            isRead: true
        });

        res.json({ message: "Marked as read" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};