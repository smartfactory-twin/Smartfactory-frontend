import SmartFactoryLayout from './SmartFactoryLayout'

export default function TechnicianLayout({ children, pageTitle = 'Dashboard' }) {
  return <SmartFactoryLayout role="TECHNICIEN" pageTitle={pageTitle}>{children}</SmartFactoryLayout>
}
