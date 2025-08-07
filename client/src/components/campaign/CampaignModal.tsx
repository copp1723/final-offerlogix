import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, X } from "lucide-react";
import { useState } from "react";
import StepIndicators from "./StepIndicators";
import CampaignForm from "./CampaignForm";

interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CampaignModal({ isOpen, onClose }: CampaignModalProps) {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <DialogTitle className="text-xl font-semibold">AI Campaign Agent</DialogTitle>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <StepIndicators currentStep={currentStep} />
        
        <CampaignForm 
          onClose={onClose}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
        />
      </DialogContent>
    </Dialog>
  );
}
