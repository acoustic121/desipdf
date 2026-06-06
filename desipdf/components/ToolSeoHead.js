import SeoHead from './SeoHead'
import { getToolSeo } from '../utils/toolSeo'

export default function ToolSeoHead({ tool }) {
  const seo = getToolSeo(tool)

  return (
    <SeoHead
      title={seo.title}
      description={seo.description}
      keywords={seo.keywords}
      canonical={seo.canonical}
    />
  )
}
