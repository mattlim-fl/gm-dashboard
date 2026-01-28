import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Edit2, Save, X, Calendar, Phone, User, Clock } from "lucide-react";
import { Member, MemberStatus } from "@/services/memberService";
import { useUpdateMember, useRecordFirstVisit } from "@/hooks/useMembers";
import { format } from "date-fns";

interface MemberDetailDialogProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MemberDetailDialog({ member, isOpen, onClose }: MemberDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    status: "active" as MemberStatus,
  });

  const updateMember = useUpdateMember();
  const recordFirstVisit = useRecordFirstVisit();

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name,
        phone: member.phone,
        status: member.status,
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
        },
      });
      setIsEditing(false);
    } catch {
      // Error handled by mutation
    }
  };

  const handleRecordFirstVisit = async () => {
    if (!member) return;

    try {
      await recordFirstVisit.mutateAsync(member.id);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
            Member Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Venue Badge */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-sm">
              {getVenueLabel(member.venue)}
            </Badge>
            {getStatusBadge(member.status)}
          </div>

          {/* First Visit Alert */}
          {!member.first_visit_date && member.status === "active" && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-amber-800">First Visit Pending</p>
                    <p className="text-sm text-amber-700">
                      Entitled to $60 welcome drinks
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-amber-300 text-amber-800 hover:bg-amber-100"
                    onClick={handleRecordFirstVisit}
                    disabled={recordFirstVisit.isPending}
                  >
                    {recordFirstVisit.isPending ? "Recording..." : "Record Visit"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

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

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      name: member.name,
                      phone: member.phone,
                      status: member.status,
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Details</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gm-neutral-500" />
                    <div>
                      <p className="text-xs text-gm-neutral-500">Name</p>
                      <p className="font-medium">{member.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gm-neutral-500" />
                    <div>
                      <p className="text-xs text-gm-neutral-500">Phone</p>
                      <p className="font-medium">{member.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-gm-neutral-500" />
                    <div>
                      <p className="text-xs text-gm-neutral-500">Date of Birth</p>
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
                    <Clock className="h-4 w-4 text-gm-neutral-500" />
                    <div>
                      <p className="text-xs text-gm-neutral-500">Joined</p>
                      <p className="font-medium">{formatDate(member.membership_start)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-gm-neutral-500" />
                    <div>
                      <p className="text-xs text-gm-neutral-500">Expires</p>
                      <p className="font-medium">{formatDate(member.membership_expiry)}</p>
                    </div>
                  </div>

                  {member.first_visit_date && (
                    <div className="flex items-center gap-3">
                      <Star className="h-4 w-4 text-amber-500" />
                      <div>
                        <p className="text-xs text-gm-neutral-500">First Visit</p>
                        <p className="font-medium">{formatDate(member.first_visit_date)}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
