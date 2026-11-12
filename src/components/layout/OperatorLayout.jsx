import SmartFactoryLayout from './SmartFactoryLayout'

export default function OperatorLayout({ children, pageTitle = 'Dashboard' }) {
  return <SmartFactoryLayout role="OPERATEUR" pageTitle={pageTitle}>{children}</SmartFactoryLayout>
}
