interface StepIndicatorsProps {
  currentStep: number;
}

export default function StepIndicators({ currentStep }: StepIndicatorsProps) {
  const steps = [
    { number: 1, title: "Campaign Setup" },
    { number: 2, title: "AI Enhancement" },
    { number: 3, title: "Review & Launch" }
  ];

  return (
    <div className="px-6 py-4 bg-gray-50 rounded-lg mb-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step.number 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-300 text-gray-500'
              }`}>
                {step.number}
              </div>
              <span className={`text-sm font-medium ${
                currentStep >= step.number 
                  ? 'text-blue-600' 
                  : 'text-gray-500'
              }`}>
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 h-px bg-gray-300 mx-6"></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
