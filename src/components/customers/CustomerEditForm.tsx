import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CustomerRow, customerService } from '@/services/customerService';
import { useToast } from '@/hooks/use-toast';

interface CustomerEditFormProps {
  customer: CustomerRow;
  onSave: (customer: CustomerRow) => void;
  onCancel: () => void;
}

export const CustomerEditForm = ({ customer, onSave, onCancel }: CustomerEditFormProps) => {
  const [formData, setFormData] = useState({
    name: customer.name,
    email: customer.email || '',
    phone: customer.phone || '',
    notes: customer.notes || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    // Email or phone must be provided
    if (!formData.email.trim() && !formData.phone.trim()) {
      newErrors.email = 'Either email or phone must be provided';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Check for duplicates (for new customers or when email/phone changed)
    const emailChanged = formData.email !== (customer.email || '');
    const phoneChanged = formData.phone !== (customer.phone || '');
    
    if (!customer.id || emailChanged || phoneChanged) {
      setIsSubmitting(true);
      try {
        const duplicate = await customerService.checkDuplicate(
          formData.email || null,
          formData.phone || null
        );

        // For existing customers, ignore if duplicate is the same customer
        if (duplicate && (!customer.id || duplicate.id !== customer.id)) {
          const duplicateFields: string[] = [];
          if (formData.email && duplicate.email && duplicate.email.toLowerCase() === formData.email.toLowerCase()) {
            duplicateFields.push('email');
          }
          if (formData.phone && duplicate.phone && duplicate.phone === formData.phone) {
            duplicateFields.push('phone');
          }
          
          setErrors({
            ...errors,
            email: duplicateFields.includes('email') ? 'A customer with this email already exists' : errors.email,
            phone: duplicateFields.includes('phone') ? 'A customer with this phone number already exists' : errors.phone,
          });
          
          toast({
            title: "Duplicate customer found",
            description: `A customer with the same ${duplicateFields.join(' and ')} already exists: ${duplicate.name}`,
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
      } catch (_error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to check for duplicate customer",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }

    const updatedCustomer: CustomerRow = {
      ...customer,
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      notes: formData.notes || null,
    };

    onSave(updatedCustomer);
    if (customer.id) {
      toast({
        title: "Customer updated",
        description: "Customer information has been updated successfully.",
      });
    }
  };

  const updateField = (field: string, value: string | number | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{customer.id ? 'Edit Customer' : 'Add New Customer'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              className={errors.email ? 'border-red-500' : ''}
            />
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className={errors.phone ? 'border-red-500' : ''}
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Add any notes about this customer..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Checking...' : customer.id ? 'Save Changes' : 'Create Customer'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
