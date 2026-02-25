import Message from "../models/Message.js";
import Property from "../models/Property.js";

// Send Message
export const sendMessage = async (req, res) => {
    try {

        const { propertyId, message } = req.body;

        const property = await Property.findById(propertyId);

        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }

        const newMessage = await Message.create({
            property: propertyId,
            sender: req.user.id,
            receiver: property.owner,
            message
        });

        res.status(201).json(newMessage);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Conversation (Property Wise)
export const getConversation = async (req, res) => {
    try {

        const messages = await Message.find({
            property: req.params.propertyId,
            $or: [
                { sender: req.user.id },
                { receiver: req.user.id }
            ]
        })
        .sort({ createdAt: 1 })
        .populate("sender", "name")
        .populate("receiver", "name");

        res.json(messages);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};