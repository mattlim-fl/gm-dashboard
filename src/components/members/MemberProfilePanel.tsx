import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Edit2, Save, X, Calendar, Phone, User, Clock, StickyNote } from "lucide-react";
import { Member, MemberStatus } from "@/services/memberService";
import { useUpdateMember } from "@/hooks/useMembers";
import { format } from "date-fns";

interface MemberProfilePanelProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MemberProfilePanel({ member, isOpen, onClose }: MemberProfilePanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    status: "active" as MemberStatus,
    notes: "",
  });

  const updateMember = useUpdateMember();

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name,
        phone: member.phone,
        status: member.status,
        notes: member.notes || "",
      });
      setIsEditing(false);
    }
  }, [member]);

  if (!member) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd MMMM yyyy");
  };

  const getStatusBadge = (status: MemberStatus) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
      case "expired":
        return <Badge variant="secondary">Expired</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Cancelled</Badge>;
    }
  };

  const getVenueLabel = (venue: string) => {
    const labels: Record<string, string> = {
      manor: "Manor",
      hippie: "Hippie Club",
      daisy: "Daisy's Social Club",
    };
    return labels[venue] || venue;
  };

  const handleSave = async () => {
    if (!member) return;

    try {
      await updateMember.mutateAsync({
        id: member.id,
        data: {
          name: formData.name,
          phone: formData.phone,
          status: formData.status,
          notes: formData.notes || null,
        },
      });
      setIsEditing(false);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
              <SheetTitle>Member Details</SheetTitle>
            </div>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
          <SheetDescription>
            {getVenueLabel(member.venue)} member since {formatDate(member.membership_start)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Venue and Status Badges */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {getVenueLabel(member.venue)}
            </Badge>
            {getStatusBadge(member.status)}
          </div>

          {/* Member Info */}
          {isEditing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as MemberStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g., Bar card holder, +2 friends entry..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      name: member.name,
                      phone: member.phone,
                      status: member.status,
                      notes: member.notes || "",
                    });
                    setIsEditing(false);
                  }}
                  disabled={updateMember.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateMember.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateMember.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="font-medium">{member.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="font-medium">{member.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">{formatDate(member.date_of_birth)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Membership</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Joined</p>
                      <p className="font-medium">{formatDate(member.membership_start)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Expires</p>
                      <p className="font-medium">{formatDate(member.membership_expiry)}</p>
                    </div>
                  </div>

                  {member.first_visit_date && (
                    <div className="flex items-center gap-3">
                      <Star className="h-4 w-4 text-amber-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">First Visit</p>
                        <p className="font-medium">{formatDate(member.first_visit_date)}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {member.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <StickyNote className="h-4 w-4" />
                      Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {member.notes}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
