import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Shield, UserCheck, Clock, UserPlus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

export default function UserManagementPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    email: "",
    role: "user"
  });

  // Fetch users from API
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await apiRequest("/api/users", "GET");
      return response as User[];
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      return apiRequest("/api/users", "POST", userData);
    },
    onSuccess: () => {
      refetch();
      setIsCreateDialogOpen(false);
      setNewUser({ username: "", password: "", email: "", role: "user" });
      toast({
        title: "User Created",
        description: "New user has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user.",
        variant: "destructive",
      });
    },
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest(`/api/users/${userId}/role`, "PUT", { role });
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Role Updated",
        description: "User role has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user role.",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/users/${userId}`, "DELETE");
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "User Deleted",
        description: "User has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user.",
        variant: "destructive",
      });
    },
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="h-4 w-4 text-red-500" />;
      case "manager":
        return <UserCheck className="h-4 w-4 text-blue-500" />;
      case "user":
        return <Users className="h-4 w-4 text-green-500" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "manager":
        return "bg-blue-100 text-blue-800";
      case "user":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRolePermissions = (role: string) => {
    switch (role) {
      case "admin":
        return "Full system access, user management, all campaigns";
      case "manager":
        return "Campaign management, team oversight, reporting";
      case "user":
        return "Campaign creation, email sending, basic reporting";
      default:
        return "Limited access";
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage user roles and permissions</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => createUserMutation.mutate(newUser)}
                  disabled={createUserMutation.isPending || !newUser.username || !newUser.password}
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-red-500" />
              <div>
                <h3 className="font-semibold text-gray-900">Administrators</h3>
                <p className="text-2xl font-bold text-red-600">
                  {users.filter(u => u.role === "admin").length}
                </p>
                <p className="text-sm text-gray-500">Full access</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <UserCheck className="h-8 w-8 text-blue-500" />
              <div>
                <h3 className="font-semibold text-gray-900">Managers</h3>
                <p className="text-2xl font-bold text-blue-600">
                  {users.filter(u => u.role === "manager").length}
                </p>
                <p className="text-sm text-gray-500">Team oversight</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-green-500" />
              <div>
                <h3 className="font-semibold text-gray-900">Sales Reps</h3>
                <p className="text-2xl font-bold text-green-600">
                  {users.filter(u => u.role === "user").length}
                </p>
                <p className="text-sm text-gray-500">Standard access</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No users found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getRoleIcon(user.role)}
                      <div>
                        <h3 className="font-medium text-gray-900">{user.username}</h3>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <Badge className={getRoleColor(user.role)}>{user.role}</Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {getRolePermissions(user.role)}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <Clock className="h-4 w-4" />
                      <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>

                    <Select
                      value={user.role}
                      onValueChange={(newRole) => {
                        if (newRole !== user.role) {
                          updateRoleMutation.mutate({ userId: user.id, role: newRole });
                        }
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete user "${user.username}"?`)) {
                          deleteUserMutation.mutate(user.id);
                        }
                      }}
                      disabled={deleteUserMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Permissions Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Shield className="h-5 w-5 text-red-500" />
                <h3 className="font-semibold text-red-600">Administrator</h3>
              </div>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Full system access</li>
                <li>• User role management</li>
                <li>• All campaign operations</li>
                <li>• System configuration</li>
                <li>• Analytics and reporting</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-3">
                <UserCheck className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold text-blue-600">Manager</h3>
              </div>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Campaign management</li>
                <li>• Team oversight</li>
                <li>• Advanced reporting</li>
                <li>• Template management</li>
                <li>• Performance tracking</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Users className="h-5 w-5 text-green-500" />
                <h3 className="font-semibold text-green-600">Sales Rep</h3>
              </div>
              <ul className="space-y-1 text-sm text-gray-600">
                <li>• Campaign creation</li>
                <li>• Email sending</li>
                <li>• Basic reporting</li>
                <li>• Customer conversations</li>
                <li>• Personal analytics</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}