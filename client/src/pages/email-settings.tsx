import { EmailSettingsPanel } from "@/components/EmailSettingsPanel";

export default function EmailSettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Email Settings</h1>
        <p className="text-lg text-gray-600">Configure how your emails appear to recipients</p>
      </div>

      <EmailSettingsPanel />
    </div>
  );
}