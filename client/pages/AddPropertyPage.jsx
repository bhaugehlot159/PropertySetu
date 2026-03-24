import { useState } from "react";
import { createProperty } from "../services/propertyService.js";
import { uploadPropertyImage } from "../services/uploadService.js";

const initialForm = {
  title: "",
  city: "",
  price: "",
  propertyType: "Apartment",
  bedrooms: "2",
  bathrooms: "2",
  areaSqft: "",
  description: "",
  imageUrl: ""
};

function AddPropertyPage() {
  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const onInput = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatusMessage("Submitting property...");

    try {
      let uploadedImageUrl = form.imageUrl.trim();

      if (imageFile) {
        setStatusMessage("Uploading image to storage provider...");
        uploadedImageUrl = await uploadPropertyImage(imageFile);
      }

      await createProperty({
        title: form.title,
        city: form.city,
        price: Number(form.price),
        propertyType: form.propertyType,
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        areaSqft: Number(form.areaSqft),
        description: form.description,
        imageUrls: uploadedImageUrl ? [uploadedImageUrl] : []
      });

      setStatusMessage("Property added successfully.");
      setForm(initialForm);
      setImageFile(null);
    } catch (error) {
      setStatusMessage(
        error?.response?.data?.message || error?.message || "Submission failed."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page">
      <div className="page-header">
        <h1>Add Property</h1>
        <p>Cloud upload + Mongo save flow with professional API routes.</p>
      </div>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            required
            name="title"
            value={form.title}
            onChange={onInput}
            placeholder="3BHK Lake View Apartment"
          />
        </label>

        <label>
          City
          <input
            required
            name="city"
            value={form.city}
            onChange={onInput}
            placeholder="Udaipur"
          />
        </label>

        <label>
          Price (INR)
          <input
            required
            type="number"
            min="1"
            name="price"
            value={form.price}
            onChange={onInput}
          />
        </label>

        <label>
          Type
          <select name="propertyType" value={form.propertyType} onChange={onInput}>
            <option>Apartment</option>
            <option>Villa</option>
            <option>Penthouse</option>
            <option>Plot</option>
            <option>Commercial</option>
          </select>
        </label>

        <label>
          Bedrooms
          <input
            type="number"
            min="0"
            name="bedrooms"
            value={form.bedrooms}
            onChange={onInput}
          />
        </label>

        <label>
          Bathrooms
          <input
            type="number"
            min="0"
            name="bathrooms"
            value={form.bathrooms}
            onChange={onInput}
          />
        </label>

        <label>
          Area (sqft)
          <input
            required
            type="number"
            min="100"
            name="areaSqft"
            value={form.areaSqft}
            onChange={onInput}
          />
        </label>

        <label>
          Description
          <textarea
            rows="4"
            name="description"
            value={form.description}
            onChange={onInput}
            placeholder="Short description for listing card and details."
          />
        </label>

        <label>
          Image URL (optional)
          <input
            name="imageUrl"
            value={form.imageUrl}
            onChange={onInput}
            placeholder="https://..."
          />
        </label>

        <label>
          Upload Image File (optional)
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setImageFile(event.target.files?.[0] || null)}
          />
        </label>

        <button className="button" disabled={saving} type="submit">
          {saving ? "Saving..." : "Create Listing"}
        </button>
      </form>

      {statusMessage ? <p className="muted-text">{statusMessage}</p> : null}
    </section>
  );
}

export default AddPropertyPage;
