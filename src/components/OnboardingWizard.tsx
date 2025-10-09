"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Package, FileText, BarChart3, Upload, ArrowRight, Sparkles } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <Sparkles className="h-16 w-16 text-primary mx-auto mb-6 animate-pulse" />
            <CardTitle className="text-3xl font-bold mb-3">Welcome to InventoryPro!</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Let's quickly set up your inventory management system.
            </CardDescription>
          </>
        );
      case 2:
        return (
          <>
            <Package className="h-16 w-16 text-blue-500 mx-auto mb-6" />
            <CardTitle className="text-3xl font-bold mb-3">Manage Your Products</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Easily add, edit, and track all your inventory items. Keep an eye on stock levels!
            </CardDescription>
          </>
        );
      case 3:
        return (
          <>
            <FileText className="h-16 w-16 text-green-500 mx-auto mb-6" />
            <CardTitle className="text-3xl font-bold mb-3">Create & Track Invoices</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              Generate professional invoices, manage customer details, and monitor sales.
            </CardDescription>
          </>
        );
      case 4:
        return (
          <>
            <BarChart3 className="h-16 w-16 text-purple-500 mx-auto mb-6" />
            <CardTitle className="text-3xl font-bold mb-3">Gain Insights with Dashboard</CardTitle>
            <CardDescription className="text-lg text-muted-foreground">
              View sales performance, profit analysis, and key metrics at a glance.
            </CardDescription>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-background to-muted flex items-center justify-center p-4 z-50 animate-fade-in">
      <Card className="w-full max-w-2xl text-center shadow-card bg-card/90 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <Progress value={(step / totalSteps) * 100} className="w-full mb-6 h-2" />
          {renderStepContent()}
        </CardHeader>
        <CardContent className="py-6">
          {/* Additional content for each step can go here if needed */}
        </CardContent>
        <CardFooter className="flex justify-between pt-4">
          <Button variant="ghost" onClick={handleSkip}>
            Skip
          </Button>
          <Button onClick={handleNext} className="bg-gradient-primary hover:shadow-glow">
            {step < totalSteps ? (
              <>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Get Started <CheckCircle className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default OnboardingWizard;