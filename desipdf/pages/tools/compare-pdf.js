import ToolSeoHead from '../../components/ToolSeoHead'
import ComingSoon from '../../components/ComingSoon'
import { TOOLS } from '../../utils/constants'
const tool = TOOLS.find((t) => t.id === 'compare-pdf')
export default function Page() {
  return (
    <>
      <ToolSeoHead tool={tool} />
      <ComingSoon tool={tool} />
    </>
  )
}
