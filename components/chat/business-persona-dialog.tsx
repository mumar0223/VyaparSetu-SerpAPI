"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MapPin, Building2, Tag, IndianRupee, User, Check, Trash2 } from "lucide-react";
import {
  saveBusinessProfile,
  clearBusinessProfile,
  type BusinessProfile,
} from "@/lib/db";
import { cn } from "@/lib/utils";

interface BusinessPersonaDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: BusinessProfile | null;
  onProfileSaved: (profile: BusinessProfile) => void;
  onProfileCleared: () => void;
}

const COMMON_CATEGORIES = [
  "Kirana & FMCG",
  "APMC Mandi Wholesale",
  "Textiles & Garments",
  "Bakery & Cafe",
  "Agro-Processing",
  "Hardware & Electricals",
];

const COMMON_CITIES = [
  { city: "Indore", district: "Indore APMC, Madhya Pradesh" },
  { city: "Nashik", district: "Nashik APMC Yard, Maharashtra" },
  { city: "Jaipur", district: "Johari Bazar, Jaipur, Rajasthan" },
  { city: "Bangalore", district: "Indiranagar, Bangalore, Karnataka" },
  { city: "Lucknow", district: "Hazratganj, Lucknow, Uttar Pradesh" },
  { city: "Surat", district: "Ring Road Textile Market, Surat, Gujarat" },
];

export function BusinessPersonaDialog({
  isOpen,
  onClose,
  currentProfile,
  onProfileSaved,
  onProfileCleared,
}: BusinessPersonaDialogProps) {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [monthlyTurnover, setMonthlyTurnover] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [udyamNumber, setUdyamNumber] = useState("");

  useEffect(() => {
    if (isOpen) {
      setBusinessName(currentProfile?.businessName || "");
      setOwnerName(currentProfile?.ownerName || "");
      setCategory(currentProfile?.category || "");
      setCity(currentProfile?.city || "");
      setDistrict(currentProfile?.district || "");
      setMonthlyTurnover(currentProfile?.monthlyTurnover || "");
      setGstNumber(currentProfile?.gstNumber || "");
      setUdyamNumber(currentProfile?.udyamNumber || "");
    }
  }, [isOpen, currentProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim() && !district.trim() && !businessName.trim()) {
      return;
    }

    const updated = await saveBusinessProfile({
      businessName: businessName.trim() || "My MSME Enterprise",
      ownerName: ownerName.trim() || "Business Owner",
      category: category.trim() || "Micro-Enterprise",
      city: city.trim() || district.trim() || "India",
      district: district.trim() || city.trim() || "India",
      monthlyTurnover: monthlyTurnover.trim() || "₹5,00,000",
      gstNumber: gstNumber.trim() || undefined,
      udyamNumber: udyamNumber.trim() || undefined,
      source: "manual",
    });

    onProfileSaved(updated);
    onClose();
  };

  const handleClear = async () => {
    await clearBusinessProfile();
    onProfileCleared();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg w-full bg-white dark:bg-card border border-sage/40 dark:border-border rounded-3xl p-6 shadow-2xl font-sans max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-mint-pale dark:bg-mint/15 text-forest dark:text-mint flex items-center justify-center shrink-0">
              <Building2 className="size-4" />
            </div>
            <DialogTitle className="text-base font-bold text-forest dark:text-foreground">
              Business & MSME Profile (व्यापार प्रोफ़ाइल)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure your enterprise details. All AI Saathi sub-agents (SWOT, Govt Schemes, Mandi, Competitors, Credit & EMI) automatically ground themselves on this profile.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 my-2">
          {/* Business Name & Owner Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="size-3.5 text-mint" />
                Shop / Enterprise Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Kisan Agro Trading"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-cream/60 dark:bg-muted/50 border border-sage/30 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-mint transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5">
                <User className="size-3.5 text-mint" />
                Owner / Proprietor
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-cream/60 dark:bg-muted/50 border border-sage/30 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-mint transition-colors"
              />
            </div>
          </div>

          {/* Trade Category */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5">
              <Tag className="size-3.5 text-mint" />
              Category / Industry Sector
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. APMC Mandi Wholesale, Kirana & FMCG, Textiles"
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-cream/60 dark:bg-muted/50 border border-sage/30 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-mint transition-colors"
            />
            {/* Quick Category Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "text-[10.5px] px-2 py-0.5 rounded-lg border transition-colors cursor-pointer",
                    category === cat
                      ? "bg-mint/15 text-forest dark:text-mint border-mint font-semibold"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* District & Location Catchment */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5 text-mint" />
              District & Market Catchment
            </label>
            <input
              type="text"
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                if (!city) setCity(e.target.value.split(",")[0].trim());
              }}
              placeholder="e.g. Lasalgaon APMC Yard, Nashik, Maharashtra"
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-cream/60 dark:bg-muted/50 border border-sage/30 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-mint transition-colors"
            />
            {/* Quick City Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {COMMON_CITIES.map((c) => (
                <button
                  type="button"
                  key={c.city}
                  onClick={() => {
                    setCity(c.city);
                    setDistrict(c.district);
                  }}
                  className={cn(
                    "text-[10.5px] px-2 py-0.5 rounded-lg border transition-colors cursor-pointer",
                    district.includes(c.city)
                      ? "bg-mint/15 text-forest dark:text-mint border-mint font-semibold"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-transparent"
                  )}
                >
                  📍 {c.city}
                </button>
              ))}
            </div>
          </div>

          {/* Monthly Turnover */}
          <div className="space-y-1.5">
            <label className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5">
              <IndianRupee className="size-3.5 text-mint" />
              Approx. Monthly Turnover (for Schemes & EMI Structuring)
            </label>
            <input
              type="text"
              value={monthlyTurnover}
              onChange={(e) => setMonthlyTurnover(e.target.value)}
              placeholder="e.g. ₹5,00,000 / month"
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-cream/60 dark:bg-muted/50 border border-sage/30 dark:border-border text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-mint transition-colors"
            />
          </div>

          {/* GSTIN & Udyam Registration (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5">
                <span>GSTIN (Optional)</span>
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                placeholder="e.g. 27AAAAA0000A1Z5"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-cream/60 dark:bg-muted/50 border border-sage/30 dark:border-border text-foreground placeholder:text-muted-foreground uppercase font-mono focus:outline-hidden focus:border-mint transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5">
                <span>Udyam Aadhar (Optional)</span>
              </label>
              <input
                type="text"
                value={udyamNumber}
                onChange={(e) => setUdyamNumber(e.target.value.toUpperCase())}
                placeholder="e.g. UDYAM-MH-12-0012345"
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-cream/60 dark:bg-muted/50 border border-sage/30 dark:border-border text-foreground placeholder:text-muted-foreground uppercase font-mono focus:outline-hidden focus:border-mint transition-colors"
              />
            </div>
          </div>

          <div className="pt-4 mt-6 border-t border-sage/30 dark:border-border flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            {currentProfile ? (
              <button
                type="button"
                onClick={handleClear}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-destructive hover:bg-destructive/10 border border-destructive/20 hover:border-destructive/40 transition-all cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Reset Profile</span>
              </button>
            ) : (
              <div className="hidden sm:block" />
            )}

            <div className="w-full sm:w-auto flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold text-foreground/80 hover:text-foreground bg-white dark:bg-card border border-sage/30 dark:border-border hover:bg-cream dark:hover:bg-muted transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-mint hover:bg-mint/90 text-forest-deep dark:text-black shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <Check className="size-3.5 stroke-[2.5]" />
                <span>Save Profile</span>
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const UserProfileDialog = BusinessPersonaDialog;
