import SmartFactoryLayout from './SmartFactoryLayout'

export default function AdminLayout({ children, pageTitle = "Vue d'ensemble" }) {
  return <SmartFactoryLayout role="ADMIN" pageTitle={pageTitle}>{children}</SmartFactoryLayout>
}
