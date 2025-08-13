import type { CollectionConfig } from 'payload'

const Slides: CollectionConfig = {
  slug: 'slides',
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'type',
      type: 'select',
      required: false,
      defaultValue: 'regular',
      enumName: 'slide_type_enum',
      options: [
        {
          label: 'Regular',
          value: 'regular',
        },
        {
          label: 'Title',
          value: 'title',
        },
        {
          label: 'Section',
          value: 'section',
        },
        {
          label: 'Bullets',
          value: 'bullets',
        },
        {
          label: 'Image',
          value: 'image',
        },
        {
          label: 'Conclusion',
          value: 'conclusion',
        },
        {
          label: 'Video',
          value: 'video',
        },
        {
          label: 'Quiz',
          value: 'quiz',
        },
        {
          label: 'Reference',
          value: 'reference',
        },
        {
          label: 'Resources',
          value: 'resources',
        },
      ],
      admin: {
        isClearable: false,
      },
    },
    {
      name: 'urls',
      type: 'array',
      fields: [
        {
          name: 'url',
          type: 'text',
        },
      ],
    },
    {
      name: 'extractedText',
      type: 'textarea',
      label: 'Extracted Text',
      admin: {
        description: 'Text content extracted from the PDF page',
        readOnly: true,
      },
    },
    {
      name: 'pdfPage',
      type: 'upload',
      relationTo: 'media',
      label: 'PDF Page',
      admin: {
        description: 'Single-page PDF for client-side image conversion',
      },
    },
    {
      name: 'pageNumber',
      type: 'number',
      label: 'Page Number',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'pageDimensions',
      type: 'group',
      label: 'Page Dimensions',
      fields: [
        {
          name: 'width',
          type: 'number',
          label: 'Width (px)',
        },
        {
          name: 'height',
          type: 'number',
          label: 'Height (px)',
        },
      ],
    },
    {
      name: 'search_vector',
      type: 'text',
      access: {
        read: () => false,
      },
      hooks: {
        beforeChange: [
          ({ data }) => {
            const title = data?.title || ''
            const description = data?.description || ''
            const extractedText = data?.extractedText || ''
            return `${title} ${description} ${extractedText}`
          },
        ],
      },
    },
  ],
}

export default Slides
