import type { NextApiRequest, NextApiResponse } from "next";
import { getAllCollections, createCollection } from "@/lib/db/repositories";
import { withAuth } from "@/lib/api";
import type { DBCollection } from "@/types";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DBCollection[] | DBCollection | { error: string }>
) {
  try {
    if (req.method === "GET") {
      const collections = await getAllCollections();
      return res.status(200).json(collections);
    }

    if (req.method === "POST") {
      const { name, description, color, icon } = req.body;

      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Name is required" });
      }

      const collection = await createCollection({
        name,
        description,
        color,
        icon,
      });

      return res.status(201).json(collection);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("[API] Collections error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withAuth(handler);
