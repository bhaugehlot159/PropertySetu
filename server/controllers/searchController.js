import Property from "../models/Property.js";

const defaultSuggestions = [
  "Hiran Magri Sector 1",
  "Hiran Magri Sector 2",
  "Hiran Magri Sector 3",
  "Pratap Nagar",
  "Ambamata",
  "Sukher",
  "Bhuwana",
  "Bedla",
  "Fatehpura",
  "Goverdhan Vilas",
  "Shobhagpura",
  "Celebration Mall Area"
];

export const searchProperties = async (req, res) => {
  try {
    const { city, type, minPrice, maxPrice, keyword } = req.query;

    const query = {};

    if (city) query.location = { $regex: city, $options: "i" };
    if (type) query.type = type;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    if (keyword) {
      query.title = { $regex: keyword, $options: "i" };
    }

    const properties = await Property.find(query);
    res.json(properties);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getLocationSuggestions = async (req, res) => {
  const q = (req.query.q || "").trim();

  if (!q) {
    return res.json(defaultSuggestions.slice(0, 8));
  }

  try {
    const dbSuggestions = await Property.distinct("location", {
      location: { $regex: q, $options: "i" }
    });

    const merged = [...new Set([...dbSuggestions, ...defaultSuggestions])]
      .filter((item) => item.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);

    return res.json(merged);
  } catch (error) {
    const fallback = defaultSuggestions
      .filter((item) => item.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);

    return res.json(fallback);
  }
};
