import React, { useState, useEffect, useDeferredValue } from 'react';
import { Search } from 'lucide-react';
import { Input } from "@/components/ui/input";

interface ProductSearchInputProps {
  onSearchTermChange: (term: string) => void;
  // Removed initialSearchTerm prop
}

const ProductSearchInput: React.FC<ProductSearchInputProps> = ({ onSearchTermChange }) => {
  const [searchInput, setSearchInput] = useState(''); // Internal state for the input field
  const deferredSearch = useDeferredValue(searchInput);

  // Notify parent only when the deferred search term changes
  useEffect(() => {
    onSearchTermChange(deferredSearch);
  }, [deferredSearch, onSearchTermChange]);

  return (
    <div className="relative flex-1 w-full">
      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search products by name, SKU, or category..."
        value={searchInput} // Input value is controlled by internal state
        onChange={(e) => setSearchInput(e.target.value)}
        className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-primary"
      />
    </div>
  );
};

export default ProductSearchInput;