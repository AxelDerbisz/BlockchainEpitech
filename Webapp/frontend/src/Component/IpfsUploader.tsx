// components/IpfsUploader.tsx
import React, { useState } from "react";
import { NFTStorage, File } from "nft.storage";

const NFT_STORAGE_KEY = process.env.REACT_APP_NFT_STORAGE_KEY ||
    "";
// 👈 replace with your NFT.Storage API key

interface IpfsUploaderProps {
    onUploaded: (metadataUrl: string) => void; // called after metadata.json is uploaded
}

export default function IpfsUploader({ onUploaded }: IpfsUploaderProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [ipfsUrl, setIpfsUrl] = useState<string | null>(null);

    async function handleUpload() {
        if (!file) return alert("Select a photo first");

        setUploading(true);
        setProgress(10);

        try {
            const client = new NFTStorage({
                token: NFT_STORAGE_KEY.trim(),
                endpoint: new URL("https://api.nft.storage"), // 👈 explicitly define API endpoint
            });

            // Step 1: Upload image
            const imageCid = await client.storeBlob(file);
            const imageUri = `ipfs://${imageCid}/${file.name}`;
            setProgress(50);

            // Step 2: Create metadata.json
            const metadata = {
                name: file.name.replace(/\.[^/.]+$/, ""),
                description: "NFT created from a photo 📸",
                image: imageUri,
                attributes: [
                    { trait_type: "Device", value: "Phone" },
                    { trait_type: "Network", value: "XRPL Testnet" },
                ],
            };

            const blob = new Blob([JSON.stringify(metadata)], { type: "application/json" });
            const metaFile = new File([blob], "metadata.json");

            // Step 3: Upload metadata.json
            const metadataCid = await client.storeBlob(metaFile);
            const metadataUrl = `ipfs://${metadataCid}`;
            setIpfsUrl(metadataUrl);
            setProgress(100);

            // Step 4: notify parent component
            onUploaded(metadataUrl);

        } catch (err: any) {
            alert("Upload failed: " + err.message);
            console.error(err);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="p-4 border rounded-lg bg-white shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-2">Upload a photo to IPFS</h3>

            <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mb-3"
            />

            <button
                type="button"
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`px-4 py-2 rounded-lg text-white font-medium ${uploading ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
            >
                {uploading ? "Uploading..." : "Upload to IPFS"}
            </button>

            {uploading && (
                <div className="mt-2 text-sm text-gray-600">Progress: {progress}%</div>
            )}

            {ipfsUrl && (
                <div className="mt-3 text-sm">
                    ✅ Metadata uploaded:
                    <br />
                    <code className="text-indigo-600">{ipfsUrl}</code>
                </div>
            )}
        </div>
    );
}
