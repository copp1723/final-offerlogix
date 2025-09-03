import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bot, Settings, X } from "lucide-react";

interface CampaignChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAI: () => void;
  onSelectManual: () => void;
}

export default function CampaignChoiceModal({ 
  isOpen, 
  onClose, 
  onSelectAI, 
  onSelectManual 
}: CampaignChoiceModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="text-xl font-semibold">Create Campaign</DialogTitle>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>
        
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-6">
            How would you like to create your campaign?
          </p>
          
          <Button
            onClick={onSelectAI}
            className="w-full justify-start h-auto p-4 min-h-[80px]"
            variant="default"
          >
            <Bot className="w-5 h-5 mr-3 flex-shrink-0" />
            <div className="text-left flex-1">
              <div className="font-medium text-base">AI Campaign Agent</div>
              <div className="text-sm text-blue-100 mt-1">
                Guided setup with AI assistance and smart suggestions
              </div>
            </div>
          </Button>

          <Button
            onClick={onSelectManual}
            variant="outline"
            className="w-full justify-start h-auto p-4 min-h-[80px]"
          >
            <Settings className="w-5 h-5 mr-3 flex-shrink-0" />
            <div className="text-left flex-1">
              <div className="font-medium text-base">Manual Setup</div>
              <div className="text-sm text-gray-500 mt-1">
                Advanced configuration with full control over settings
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}