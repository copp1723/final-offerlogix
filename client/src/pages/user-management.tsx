import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Shield, UserCheck, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

export default function UserManagementPage() {
  const { toast } = useToast();
  
  // Mock user data for demo - in real app this would come from API
  const mockUsers: User[] = [
    {
      id: "1",
      username: "admin_user",
      password: "***",
      role: "admin",
      email: "admin@dealership.com",
      createdAt: new Date("2024-01-15"),
      clientId: null,
    },
    {
      id: "2", 
      username: "sales_manager",
      password: "***",
      role: "manager",
      email: "manager@dealership.com",
      createdAt: new Date("2024-02-10"),
      clientId: null,
    },
    {
      id: "3",
      username: "sales_rep1",
      password: "***", 
      role: "user",
      email: "rep1@dealership.com",
      createdAt: new Date("2024-03-05"),
      clientId: null,
    },
    {
      id: "4",
      username: "sales_rep2",
      password: "***",
      role: "user", 
      email: "rep2@dealership.com",
      createdAt: new Date("2024-03-12"),
      clientId: null,
    },
  ];

  const [users, setUsers] = useState<User[]>(mockUsers);

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest(`/api/users/${userId}/role`, "PUT", { role });
    },
    onSuccess: (_, { userId, role }) => {
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, role } : user
      ));
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600 mt-1">Manage user roles and permissions</p>
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
                </div>
              </div>
            ))}
          </div>
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