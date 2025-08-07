import type { CollectionConfig } from "payload";

const PdfPages: CollectionConfig = {
  slug: "pdf-pages",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "pageNumber", "module", "media"],
    description: "One document per PDF page, linked to its Module and Media preview.",
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => !!user,
    update: ({ req: { user } }) => !!user,
    delete: ({ req: { user } }) => !!user,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
    },
    {
      name: "pageNumber",
      type: "number",
      required: true,
      min: 1,
      admin: {
        description: "1-based page index within the original PDF.",
      },
    },
    {
      name: "module",
      type: "relationship",
      relationTo: "modules",
      required: true,
      admin: {
        description: "Module that the original PDF was uploaded to.",
      },
    },
    {
      name: "media",
      type: "relationship",
      relationTo: "media",
      required: true,
      admin: {
        description: "Rendered image for this page.",
      },
    },
    {
      name: "text",
      type: "textarea",
      admin: {
        description: "Optional extracted text for this page (future use).",
      },
    },
    {
      name: "sourcePdf",
      type: "relationship",
      relationTo: "media",
      admin: {
        description: "The original uploaded PDF (media doc).",
      },
    },
  ],
  indexes: [
    {
      fields: ["module", "pageNumber"],
      unique: true,
    },
  ],
};

export default PdfPages;
