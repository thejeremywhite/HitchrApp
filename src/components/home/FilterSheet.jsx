
import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function FilterSheet({ open, onClose, sortBy, setSortBy }) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      {/* 
        The SheetContent is the primary "overlay" for this component.
        Adding 'bg-white' ensures a solid white background, removing any potential transparency
        and fulfilling the 'backgroundColor: #FFFFFF' requirement for this part of the UI.
      */}
      <SheetContent side="bottom" className="rounded-t-3xl bg-white">
        <SheetHeader>
          <SheetTitle>Sort & Filter</SheetTitle>
        </SheetHeader>
        
        <div className="py-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Sort by</Label>
            <RadioGroup value={sortBy} onValueChange={setSortBy}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="closest" id="closest" />
                <Label htmlFor="closest" className="font-normal cursor-pointer">
                  Closest first
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="price" id="price" />
                <Label htmlFor="price" className="font-normal cursor-pointer">
                  Lowest price first
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="rating" id="rating" />
                <Label htmlFor="rating" className="font-normal cursor-pointer">
                  Highest rated
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
