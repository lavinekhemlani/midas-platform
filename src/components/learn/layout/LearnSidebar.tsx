'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Filter, X } from 'lucide-react';
import Link from 'next/link';

interface LearnSidebarProps {
  categories: string[];
  selectedCategory?: string;
  onCategoryChange: (category: string | null) => void;
  onSearch: (query: string) => void;
}

export function LearnSidebar({ 
  categories, 
  selectedCategory, 
  onCategoryChange, 
  onSearch 
}: LearnSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch(value);
  };

  const handleCategorySelect = (category: string) => {
    if (selectedCategory === category) {
      onCategoryChange(null);
    } else {
      onCategoryChange(category);
    }
  };

  return (
    <div className="w-80 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-xl font-semibold theme-text-primary mb-2">
            Financial Learning
          </h2>
          <p className="text-sm theme-text-secondary">
            Master the language of finance
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 theme-text-secondary" />
          <Input
            placeholder="Search terms..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="zenith-input pl-10"
          />
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <Link href="/learn/paths">
            <Button variant="outline" className="w-full justify-start">
              <BookOpen className="w-4 h-4 mr-2" />
              Learning Paths
            </Button>
          </Link>
        </div>

        {/* Categories */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Categories</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategorySelect(category)}
                className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                  selectedCategory === category
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 theme-text-secondary hover:theme-text-primary'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{category}</span>
                  {selectedCategory === category && (
                    <X className="w-3 h-3" />
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Progress Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700 border-blue-200 dark:border-slate-600">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium theme-text-primary">Learning Progress</p>
                <p className="text-sm theme-text-secondary">0 terms completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}