import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Users, UserCheck, Clock, X } from "lucide-react";
import { useMembers } from "@/hooks/useMembers";
import { Member, MemberFilters, Venue, MemberStatus } from "@/services/memberService";
import { format } from "date-fns";
import { MemberDetailDialog } from "@/components/members/MemberDetailDialog";
import { AddMemberDialog } from "@/components/members/AddMemberDialog";
import { Link } from "react-router-dom";

const Members = () => {
  const [search, setSearch] = useState("");
  const [venueFilter, setVenueFilter] = useState<Venue | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("all");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const filters: MemberFilters = {
    ...(venueFilter !== "all" && { venue: venueFilter }),
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(search && { search }),
  };

  const { data: members = [], isLoading } = useMembers(filters);

  const stats = useMemo(() => {
    return {
      total: members.length,
      active: members.filter((m) => m.status === "active").length,
      pending: members.filter((m) => !m.first_visit_date).length,
    };
  }, [members]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd/MM/yyyy");
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

  const getVenueBadge = (venue: Venue) => {
    const colors = {
      manor: "bg-purple-100 text-purple-800",
      hippie: "bg-pink-100 text-pink-800",
      daisy: "bg-yellow-100 text-yellow-800",
    };
    return (
      <Badge className={`${colors[venue]} hover:${colors[venue]}`}>
        {venue.charAt(0).toUpperCase() + venue.slice(1)}
      </Badge>
    );
  };

  const handleViewMember = (member: Member) => {
    setSelectedMember(member);
    setIsDetailOpen(true);
  };

  const clearFilters = () => {
    setSearch("");
    setVenueFilter("all");
    setStatusFilter("all");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gm-neutral-900 dark:text-white">Members</h1>
            <p className="text-gm-neutral-600 dark:text-gm-neutral-400">
              Manage memberships across all venues
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/members/checkin">
                <UserCheck className="h-4 w-4 mr-2" />
                Door Check-in
              </Link>
            </Button>
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-gm-neutral-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "-" : stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Members</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{isLoading ? "-" : stats.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Awaiting First Visit</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{isLoading ? "-" : stats.pending}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gm-neutral-800 p-4 rounded-lg border border-gm-neutral-200 dark:border-gm-neutral-700">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gm-neutral-400 h-4 w-4" />
              <Input
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={venueFilter} onValueChange={(v) => setVenueFilter(v as Venue | "all")}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="All Venues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Venues</SelectItem>
                <SelectItem value="manor">Manor</SelectItem>
                <SelectItem value="hippie">Hippie</SelectItem>
                <SelectItem value="daisy">Daisy's</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as MemberStatus | "all")}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-gm-neutral-600 dark:text-gm-neutral-400">
          {members.length} member{members.length !== 1 ? "s" : ""} found
        </p>

        {/* Members Table */}
        <div className="bg-white dark:bg-gm-neutral-900 rounded-lg border border-gm-neutral-200 dark:border-gm-neutral-700 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>DOB</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>First Visit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gm-neutral-500">
                    No members found
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow
                    key={member.id}
                    className="cursor-pointer hover:bg-gm-neutral-50 dark:hover:bg-gm-neutral-800"
                    onClick={() => handleViewMember(member)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {member.name}
                        {!member.first_visit_date && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            NEW
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{member.phone}</TableCell>
                    <TableCell>{formatDate(member.date_of_birth)}</TableCell>
                    <TableCell>{getVenueBadge(member.venue)}</TableCell>
                    <TableCell>{getStatusBadge(member.status)}</TableCell>
                    <TableCell>{formatDate(member.membership_start)}</TableCell>
                    <TableCell>{formatDate(member.membership_expiry)}</TableCell>
                    <TableCell>
                      {member.first_visit_date ? (
                        formatDate(member.first_visit_date)
                      ) : (
                        <span className="text-gm-neutral-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Member Detail Dialog */}
        <MemberDetailDialog
          member={selectedMember}
          isOpen={isDetailOpen}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedMember(null);
          }}
        />

        {/* Add Member Dialog */}
        <AddMemberDialog
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
};

export default Members;
