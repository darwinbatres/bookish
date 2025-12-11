import type { NextApiRequest, NextApiResponse } from "next";
import {
  getCollectionById,
  updateCollection,
  deleteCollection,
} from "@/lib/db/repositories";
import { withAuth } from "@/lib/api";
import type { DBCollection } from "@/types";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DBCollection | { error: string } | { success: boolean }>
) {
  const { id } = req.query;

  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid collection ID" });
  }

  try {
    if (req.method === "GET") {
      const collection = await getCollectionById(id);
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      return res.status(200).json(collection);
    }

    if (req.method === "PATCH") {
      const { name, description, color, icon, sortOrder } = req.body;
      const collection = await updateCollection(id, {
        name,
        description,
        color,
        icon,
        sortOrder,
      });
      if (!collection) {
        return res.status(404).json({ error: "Collection not found" });
      }
      return res.status(200).json(collection);
    }

    if (req.method === "DELETE") {
      const deleted = await deleteCollection(id);
      if (!deleted) {
        return res.status(404).json({ error: "Collection not found" });
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("[API] Collection error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withAuth(handler);
