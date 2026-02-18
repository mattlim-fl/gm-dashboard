import { useState, useRef, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ArrowLeft, Check, Star, Gift, X, UserCheck } from "lucide-react";
import { useSearchMembers, useRecordFirstVisit } from "@/hooks/useMembers";
import { Member, MemberStatus, Venue } from "@/services/memberService";
import { Link } from "react-router-dom";
import { format, differenceInYears } from "date-fns";

const MemberCheckin = () => {
  const [search, setSearch] = useState("");
  const [checkedInMember, setCheckedInMember] = useState<Member | null>(null);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: members = [], isLoading } = useSearchMembers(search);
  const recordFirstVisit = useRecordFirstVisit();

  // Auto-focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Reset checked-in state after 5 seconds
  useEffect(() => {
    if (checkedInMember) {
      const timer = setTimeout(() => {
        setCheckedInMember(null);
        setShowWelcomeMessage(false);
        setSearch("");
        searchInputRef.current?.focus();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [checkedInMember]);

  const getStatusBadge = (status: MemberStatus) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500 text-white text-lg px-4 py-1">Active</Badge>;
      case "expired":
        return <Badge variant="secondary" className="text-lg px-4 py-1">Expired</Badge>;
      case "cancelled":
        return <Badge variant="destructive" className="text-lg px-4 py-1">Cancelled</Badge>;
    }
  };

  const getVenueLabel = (venue: Venue) => {
    const labels = {
      manor: "Manor",
      hippie: "Hippie Club",
      daisy: "Daisy's Social Club",
    };
    return labels[venue];
  };

  const getAge = (dateOfBirth: string) => {
    return differenceInYears(new Date(), new Date(dateOfBirth));
  };

  const handleCheckin = async (member: Member) => {
    const isFirstVisit = !member.first_visit_date;

    if (isFirstVisit) {
      try {
        await recordFirstVisit.mutateAsync(member.id);
        setShowWelcomeMessage(true);
      } catch {
        // Error handled by mutation
        return;
      }
    }

    setCheckedInMember(member);
  };

  const handleReset = () => {
    setCheckedInMember(null);
    setShowWelcomeMessage(false);
    setSearch("");
    searchInputRef.current?.focus();
  };

  // Success screen
  if (checkedInMember) {
    return (
      <DashboardLayout>
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto">
            <div className="mb-8">
              <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="h-12 w-12 text-white" />
              </div>
              <h1 className="text-4xl font-bold mb-2">{checkedInMember.name}</h1>
              <p className="text-2xl text-gm-neutral-600">
                {getVenueLabel(checkedInMember.venue)} Member
              </p>
            </div>

            {showWelcomeMessage && (
              <Card className="bg-amber-50 border-amber-200 mb-8">
                <CardContent className="py-6">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <Gift className="h-8 w-8 text-amber-600" />
                    <span className="text-2xl font-bold text-amber-800">FIRST VISIT</span>
                  </div>
                  <p className="text-xl text-amber-700">
                    Welcome drinks: $60 credit
                  </p>
                </CardContent>
              </Card>
            )}

            <Button
              variant="outline"
              size="lg"
              onClick={handleReset}
              className="text-xl px-8 py-6"
            >
              <X className="h-6 w-6 mr-2" />
              Done
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild>
            <Link to="/guests?tab=members">
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Members
            </Link>
          </Button>
        </div>

        {/* Title */}
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <UserCheck className="h-8 w-8 text-gm-primary-600" />
            <h1 className="text-3xl font-bold">Member Check-in</h1>
          </div>
          <p className="text-gm-neutral-600">Search by name or phone number</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gm-neutral-400 h-6 w-6" />
          <Input
            ref={searchInputRef}
            placeholder="Type name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-14 h-16 text-xl"
            autoFocus
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gm-neutral-400 hover:text-gm-neutral-600"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="space-y-3">
          {isLoading && search.length >= 2 && (
            <Card>
              <CardContent className="py-8 text-center text-gm-neutral-500">
                Searching...
              </CardContent>
            </Card>
          )}

          {!isLoading && search.length >= 2 && members.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-gm-neutral-500">
                No members found
              </CardContent>
            </Card>
          )}

          {members.map((member) => (
            <Card
              key={member.id}
              className={`cursor-pointer transition-colors ${
                member.status === "active"
                  ? "hover:border-green-500 hover:bg-green-50"
                  : "hover:bg-gm-neutral-50"
              }`}
              onClick={() => member.status === "active" && handleCheckin(member)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{member.name}</h3>
                      {!member.first_visit_date && member.status === "active" && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                          <Star className="h-3 w-3 mr-1 fill-amber-500" />
                          FIRST VISIT
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-gm-neutral-600">
                      <span>{member.phone}</span>
                      <span>Age: {getAge(member.date_of_birth)}</span>
                      <span>{getVenueLabel(member.venue)}</span>
                    </div>
                    {member.status !== "active" && (
                      <p className="text-sm text-red-600 mt-2">
                        Membership {member.status} - expires{" "}
                        {format(new Date(member.membership_expiry), "dd/MM/yyyy")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {getStatusBadge(member.status)}
                    {member.status === "active" && (
                      <Button size="lg" className="text-lg px-6">
                        Check In
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Instructions */}
        {search.length < 2 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-gm-neutral-500 text-lg">
                Start typing to search for a member
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MemberCheckin;
