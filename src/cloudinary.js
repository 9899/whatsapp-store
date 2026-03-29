export const CLOUDINARY_CLOUD = "db83sea0x";
export const CLOUDINARY_PRESET = "whatsapp_store";

export async function uploadImage(file) {
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload failed");
  return data.secure_url;
}