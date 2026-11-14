"""
Curated developer code library and specialized drill cards for TopicTyper v5.0.
Contains 36+ realistic snippets across 6 languages (Python, C++, JS, SQL, Bash, HTML/CSS)
and 3 difficulty tiers (Beginner, Intermediate, DSA & Algorithms).
"""

CODE_SNIPPETS = {
    'python': [
        {
            'id': 'py-metrics',
            'title': 'List Comprehension & Metrics',
            'filename': 'sales_metrics.py',
            'lang': 'python',
            'difficulty': 'Beginner',
            'icon': 'python',
            'description': 'Clean Python list comprehensions, conditionals, and dictionary aggregation.',
            'code': '''def calculate_metrics(transactions):
    valid_amounts = [t["amount"] for t in transactions if t["status"] == "completed"]
    total_revenue = sum(valid_amounts)
    avg_order = total_revenue / len(valid_amounts) if valid_amounts else 0.0
    return {"total": round(total_revenue, 2), "average": round(avg_order, 2)}'''
        },
        {
            'id': 'py-config',
            'title': 'Context Manager File Parser',
            'filename': 'config_parser.py',
            'lang': 'python',
            'difficulty': 'Beginner',
            'icon': 'python',
            'description': 'Safe file parsing using with context manager and string splitting.',
            'code': '''def load_server_config(filepath):
    config = {}
    with open(filepath, "r", encoding="utf-8") as file:
        for line in file:
            clean_line = line.strip()
            if clean_line and not clean_line.startswith("#"):
                key, val = clean_line.split("=", 1)
                config[key.strip()] = val.strip()
    return config'''
        },
        {
            'id': 'py-decorator',
            'title': 'Timing & Retry Decorator',
            'filename': 'retry_decorator.py',
            'lang': 'python',
            'difficulty': 'Intermediate',
            'icon': 'python',
            'description': 'Python function decorator with arguments, wraps, and error handling.',
            'code': '''import time
from functools import wraps

def retry(max_attempts=3, delay=1.0):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as exc:
                    if attempt == max_attempts:
                        raise exc
                    time.sleep(delay)
        return wrapper
    return decorator'''
        },
        {
            'id': 'py-django-view',
            'title': 'Django Class-Based API View',
            'filename': 'user_api_view.py',
            'lang': 'python',
            'difficulty': 'Intermediate',
            'icon': 'python',
            'description': 'Idiomatic Django class-based view with JSON response handling.',
            'code': '''from django.http import JsonResponse
from django.views import View

class UserProfileView(View):
    def get(self, request, user_id):
        profile = {"id": user_id, "username": "dev_alex", "tier": "Pro"}
        return JsonResponse({"status": "success", "data": profile})

    def post(self, request, user_id):
        return JsonResponse({"message": "Profile updated successfully"})'''
        },
        {
            'id': 'py-lru-cache',
            'title': 'LRU Cache Implementation',
            'filename': 'lru_cache.py',
            'lang': 'python',
            'difficulty': 'DSA & Algorithms',
            'icon': 'python',
            'description': 'Double linked list and hash map implementation of an LRU cache.',
            'code': '''class Node:
    def __init__(self, key=0, val=0):
        self.key, self.val = key, val
        self.prev = self.next = None

class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.cache = {}
        self.head, self.tail = Node(), Node()
        self.head.next, self.tail.prev = self.tail, self.head

    def get(self, key: int) -> int:
        if key in self.cache:
            node = self.cache[key]
            self._remove(node)
            self._insert(node)
            return node.val
        return -1'''
        },
        {
            'id': 'py-bin-search',
            'title': 'Binary Search & Bounds',
            'filename': 'binary_search.py',
            'lang': 'python',
            'difficulty': 'DSA & Algorithms',
            'icon': 'python',
            'description': 'Classic binary search algorithm in Python.',
            'code': '''def binary_search(nums, target):
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1'''
        },
    ],
    'cpp': [
        {
            'id': 'cpp-vector-ops',
            'title': 'Vector Transformations',
            'filename': 'vector_ops.cpp',
            'lang': 'cpp',
            'difficulty': 'Beginner',
            'icon': 'cpp',
            'description': 'C++ STL std::vector iterations and calculations.',
            'code': '''#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::vector<int> numbers = {10, 25, 30, 45, 50, 65};
    int total = 0;
    for (const int& val : numbers) {
        if (val > 25) {
            total += val * 2;
        }
    }
    std::cout << "Computed total: " << total << std::endl;
    return 0;
}'''
        },
        {
            'id': 'cpp-string-split',
            'title': 'String Tokenizer & Stream',
            'filename': 'string_parser.cpp',
            'lang': 'cpp',
            'difficulty': 'Beginner',
            'icon': 'cpp',
            'description': 'String splitting with std::stringstream and std::vector.',
            'code': '''#include <iostream>
#include <sstream>
#include <vector>

std::vector<std::string> split(const std::string& text, char delimiter) {
    std::vector<std::string> tokens;
    std::stringstream stream(text);
    std::string token;
    while (std::getline(stream, token, delimiter)) {
        if (!token.empty()) {
            tokens.push_back(token);
        }
    }
    return tokens;
}'''
        },
        {
            'id': 'cpp-smart-pointer',
            'title': 'Smart Pointers & Unique Ptr',
            'filename': 'smart_pointer.cpp',
            'lang': 'cpp',
            'difficulty': 'Intermediate',
            'icon': 'cpp',
            'description': 'Modern C++ memory management with std::make_unique.',
            'code': '''#include <memory>
#include <string>
#include <iostream>

class ConnectionPool {
public:
    std::string endpoint;
    explicit ConnectionPool(std::string ep) : endpoint(std::move(ep)) {}
    void connect() {
        std::cout << "Connected to: " << endpoint << std::endl;
    }
};

std::unique_ptr<ConnectionPool> createPool(const std::string& host) {
    return std::make_unique<ConnectionPool>(host);
}'''
        },
        {
            'id': 'cpp-thread-queue',
            'title': 'Thread-Safe Queue Template',
            'filename': 'thread_queue.cpp',
            'lang': 'cpp',
            'difficulty': 'Intermediate',
            'icon': 'cpp',
            'description': 'C++ template queue with std::mutex and std::lock_guard.',
            'code': '''#include <queue>
#include <mutex>

template <typename T>
class SafeQueue {
private:
    std::queue<T> buffer;
    std::mutex lock;
public:
    void push(T value) {
        std::lock_guard<std::mutex> guard(lock);
        buffer.push(std::move(value));
    }
    bool empty() {
        std::lock_guard<std::mutex> guard(lock);
        return buffer.empty();
    }
};'''
        },
        {
            'id': 'cpp-lower-bound',
            'title': 'Fast Lower Bound Search',
            'filename': 'lower_bound.cpp',
            'lang': 'cpp',
            'difficulty': 'DSA & Algorithms',
            'icon': 'cpp',
            'description': 'Iterative lower-bound algorithm for sorted vectors.',
            'code': '''#include <vector>

int lowerBound(const std::vector<int>& arr, int target) {
    int low = 0;
    int high = static_cast<int>(arr.size());
    while (low < high) {
        int mid = low + (high - low) / 2;
        if (arr[mid] >= target) {
            high = mid;
        } else {
            low = mid + 1;
        }
    }
    return low;
}'''
        },
        {
            'id': 'cpp-dfs-cycle',
            'title': 'DFS Graph Cycle Detection',
            'filename': 'dfs_graph.cpp',
            'lang': 'cpp',
            'difficulty': 'DSA & Algorithms',
            'icon': 'cpp',
            'description': 'Graph cycle detection using 3-state depth-first search.',
            'code': '''#include <vector>

bool hasCycle(int node, const std::vector<std::vector<int>>& adj, std::vector<int>& visited) {
    visited[node] = 1;
    for (int next : adj[node]) {
        if (visited[next] == 1) return true;
        if (visited[next] == 0 && hasCycle(next, adj, visited)) return true;
    }
    visited[node] = 2;
    return false;
}'''
        },
    ],
    'javascript': [
        {
            'id': 'js-pipeline',
            'title': 'Array Pipeline & Reduce',
            'filename': 'array_pipeline.js',
            'lang': 'javascript',
            'difficulty': 'Beginner',
            'icon': 'javascript',
            'description': 'Functional data transformation using filter, map, and reduce.',
            'code': '''const inventory = [
  { item: "Keyboard", price: 89, inStock: true },
  { item: "Mouse", price: 49, inStock: false },
  { item: "Monitor", price: 299, inStock: true }
];

const totalValue = inventory
  .filter(product => product.inStock)
  .map(product => product.price)
  .reduce((acc, curr) => acc + curr, 0);'''
        },
        {
            'id': 'js-debounce',
            'title': 'Debounce Function Utility',
            'filename': 'debounce.js',
            'lang': 'javascript',
            'difficulty': 'Beginner',
            'icon': 'javascript',
            'description': 'Standard closure-based debounce function for event handling.',
            'code': '''function debounce(callback, delay = 300) {
  let timerId = null;
  return function(...args) {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      callback.apply(this, args);
    }, delay);
  };
}'''
        },
        {
            'id': 'js-fetch-retry',
            'title': 'Async Fetch with Backoff',
            'filename': 'fetch_retry.js',
            'lang': 'javascript',
            'difficulty': 'Intermediate',
            'icon': 'javascript',
            'description': 'Async/await network request pipeline with exponential backoff.',
            'code': '''async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200));
    }
  }
}'''
        },
        {
            'id': 'js-event-bus',
            'title': 'Typed Event Emitter',
            'filename': 'event_bus.js',
            'lang': 'javascript',
            'difficulty': 'Intermediate',
            'icon': 'javascript',
            'description': 'Clean pub/sub event bus pattern using JavaScript Maps and Sets.',
            'code': '''class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(eventName, listener) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName).add(listener);
    return () => this.handlers.get(eventName).delete(listener);
  }

  emit(eventName, payload) {
    const list = this.handlers.get(eventName);
    if (list) list.forEach(cb => cb(payload));
  }
}'''
        },
        {
            'id': 'js-min-heap',
            'title': 'Min-Heap Priority Queue',
            'filename': 'min_heap.js',
            'lang': 'javascript',
            'difficulty': 'DSA & Algorithms',
            'icon': 'javascript',
            'description': 'Binary min-heap implementation with bubble-up reorganization.',
            'code': '''class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(val) {
    this.heap.push(val);
    this._bubbleUp(this.heap.length - 1);
  }

  _bubbleUp(idx) {
    while (idx > 0) {
      const parentIdx = Math.floor((idx - 1) / 2);
      if (this.heap[idx] >= this.heap[parentIdx]) break;
      [this.heap[idx], this.heap[parentIdx]] = [this.heap[parentIdx], this.heap[idx]];
      idx = parentIdx;
    }
  }
}'''
        },
        {
            'id': 'js-topo-sort',
            'title': 'Topological Sort for DAGs',
            'filename': 'topo_sort.js',
            'lang': 'javascript',
            'difficulty': 'DSA & Algorithms',
            'icon': 'javascript',
            'description': 'Kahn algorithm for topological sorting of directed graphs.',
            'code': '''function topologicalSort(numNodes, edges) {
  const inDegree = new Array(numNodes).fill(0);
  const graph = Array.from({ length: numNodes }, () => []);
  edges.forEach(([u, v]) => {
    graph[u].push(v);
    inDegree[v]++;
  });
  const queue = [];
  for (let i = 0; i < numNodes; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }
  return queue;
}'''
        },
    ],
    'sql': [
        {
            'id': 'sql-revenue-agg',
            'title': 'Customer Revenue Aggregations',
            'filename': 'customer_revenue.sql',
            'lang': 'sql',
            'difficulty': 'Beginner',
            'icon': 'sql',
            'description': 'SQL GROUP BY, HAVING, and aggregate metrics.',
            'code': '''SELECT
  customer_id,
  COUNT(order_id) AS total_orders,
  SUM(order_total) AS total_spent,
  ROUND(AVG(order_total), 2) AS avg_basket_size
FROM orders
WHERE status = 'shipped'
GROUP BY customer_id
HAVING SUM(order_total) >= 500
ORDER BY total_spent DESC;'''
        },
        {
            'id': 'sql-table-joins',
            'title': 'Multi-Table Inner & Left Joins',
            'filename': 'orders_catalog_join.sql',
            'lang': 'sql',
            'difficulty': 'Beginner',
            'icon': 'sql',
            'description': 'Multi-table relational joins with filtering.',
            'code': '''SELECT
  u.username,
  o.order_id,
  p.product_name,
  oi.quantity,
  oi.unit_price
FROM users u
INNER JOIN orders o ON u.id = o.user_id
INNER JOIN order_items oi ON o.order_id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id
WHERE o.created_at >= '2026-01-01';'''
        },
        {
            'id': 'sql-window-rank',
            'title': 'Window Functions & Partitioning',
            'filename': 'window_ranking.sql',
            'lang': 'sql',
            'difficulty': 'Intermediate',
            'icon': 'sql',
            'description': 'DENSE_RANK() and AVG() window functions partitioned by department.',
            'code': '''SELECT
  department_id,
  employee_id,
  salary,
  DENSE_RANK() OVER (
    PARTITION BY department_id
    ORDER BY salary DESC
  ) AS dept_rank,
  AVG(salary) OVER (
    PARTITION BY department_id
  ) AS dept_avg_salary
FROM employees;'''
        },
        {
            'id': 'sql-monthly-cte',
            'title': 'Monthly Cohort Revenue CTE',
            'filename': 'monthly_revenue_cte.sql',
            'lang': 'sql',
            'difficulty': 'Intermediate',
            'icon': 'sql',
            'description': 'Common Table Expression (CTE) for monthly revenue trends.',
            'code': '''WITH monthly_metrics AS (
  SELECT
    DATE_TRUNC('month', order_date) AS sales_month,
    COUNT(DISTINCT customer_id) AS active_buyers,
    SUM(total_amount) AS gross_sales
  FROM sales
  GROUP BY sales_month
)
SELECT sales_month, active_buyers, gross_sales
FROM monthly_metrics
ORDER BY sales_month DESC;'''
        },
        {
            'id': 'sql-recursive-org',
            'title': 'Recursive CTE Org Hierarchy',
            'filename': 'org_hierarchy.sql',
            'lang': 'sql',
            'difficulty': 'DSA & Algorithms',
            'icon': 'sql',
            'description': 'Recursive common table expression navigating hierarchical employee trees.',
            'code': '''WITH RECURSIVE org_tree AS (
  SELECT id, manager_id, full_name, 1 AS depth
  FROM team_members
  WHERE manager_id IS NULL
  UNION ALL
  SELECT m.id, m.manager_id, m.full_name, t.depth + 1
  FROM team_members m
  INNER JOIN org_tree t ON m.manager_id = t.id
)
SELECT id, full_name, depth FROM org_tree ORDER BY depth;'''
        },
        {
            'id': 'sql-running-avg',
            'title': 'Cumulative Rolling Average',
            'filename': 'moving_average.sql',
            'lang': 'sql',
            'difficulty': 'DSA & Algorithms',
            'icon': 'sql',
            'description': '7-day moving window sum and average using window frames.',
            'code': '''SELECT
  recorded_date,
  daily_volume,
  SUM(daily_volume) OVER (
    ORDER BY recorded_date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS rolling_7day_sum,
  AVG(daily_volume) OVER (
    ORDER BY recorded_date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS rolling_7day_avg
FROM sensor_telemetry;'''
        },
    ],
    'bash': [
        {
            'id': 'bash-log-filter',
            'title': 'Log Analyzer & Grep Pipeline',
            'filename': 'log_analyzer.sh',
            'lang': 'bash',
            'difficulty': 'Beginner',
            'icon': 'bash',
            'description': 'Awk, grep, sort, and uniq pipelines for web server log analysis.',
            'code': '''#!/bin/bash
set -euo pipefail
LOG_FILE="/var/log/nginx/access.log"
echo "--- Top 10 IP Addresses by Request Count ---"
awk '{print $1}' "$LOG_FILE" | sort | uniq -c | sort -nr | head -n 10
echo "--- HTTP 500 Errors ---"
grep " 500 " "$LOG_FILE" | tail -n 20'''
        },
        {
            'id': 'bash-sys-health',
            'title': 'System Resources Health Check',
            'filename': 'sys_health.sh',
            'lang': 'bash',
            'difficulty': 'Beginner',
            'icon': 'bash',
            'description': 'Live server health snapshot checking uptime, memory, and disk.',
            'code': '''#!/bin/bash
echo "=== System Health Snapshot ==="
echo "Uptime: $(uptime -p)"
echo "Memory Usage:"
free -h | awk 'NR==2{printf "Used: %s / Total: %s (%.2f%%)\\n", $3, $2, $3/$2*100}'
echo "Disk Utilization:"
df -h / | awk 'NR==2{print "Root FS: " $5 " used (" $4 " available)"}' '''
        },
        {
            'id': 'bash-docker-clean',
            'title': 'Docker Container Manager',
            'filename': 'docker_cleanup.sh',
            'lang': 'bash',
            'difficulty': 'Intermediate',
            'icon': 'bash',
            'description': 'Automated docker pruning and service cluster restart.',
            'code': '''#!/bin/bash
PROJECT_NAME="topic-typer"
echo "Cleaning dangling docker images and containers..."
docker ps -a --filter "status=exited" -q | xargs -r docker rm -v
docker images -f "dangling=true" -q | xargs -r docker rmi
echo "Restarting service cluster for $PROJECT_NAME..."
docker compose restart web worker'''
        },
        {
            'id': 'bash-git-worktree',
            'title': 'Git Worktree Branch Setup',
            'filename': 'git_worktree.sh',
            'lang': 'bash',
            'difficulty': 'Intermediate',
            'icon': 'bash',
            'description': 'Git CLI automation for spinning up isolated worktree workspaces.',
            'code': '''#!/bin/bash
FEATURE_BRANCH="$1"
TARGET_DIR="../branches/$FEATURE_BRANCH"
if [ -z "$FEATURE_BRANCH" ]; then
  echo "Usage: $0 <branch-name>"
  exit 1
fi
git fetch origin main
git worktree add -b "$FEATURE_BRANCH" "$TARGET_DIR" origin/main
echo "Worktree active at $TARGET_DIR"'''
        },
        {
            'id': 'bash-batch-convert',
            'title': 'Parallel File Conversion',
            'filename': 'batch_convert.sh',
            'lang': 'bash',
            'difficulty': 'DSA & Algorithms',
            'icon': 'bash',
            'description': 'Multiprocess image conversion utilizing find, xargs, and parallel workers.',
            'code': '''#!/bin/bash
SOURCE_DIR="./raw_assets"
DEST_DIR="./optimized"
mkdir -p "$DEST_DIR"
find "$SOURCE_DIR" -type f -name "*.png" -print0 | xargs -0 -P 4 -I {} bash -c '
  base=$(basename "{}" .png)
  cwebp -q 85 "{}" -o "'"$DEST_DIR"'/${base}.webp"
'
echo "Batch compression finished."'''
        },
        {
            'id': 'bash-rate-monitor',
            'title': 'Nginx DoS Traffic Monitor',
            'filename': 'rate_monitor.sh',
            'lang': 'bash',
            'difficulty': 'DSA & Algorithms',
            'icon': 'bash',
            'description': 'Automated request rate monitoring and threshold checking script.',
            'code': '''#!/bin/bash
THRESHOLD=50
tail -n 1000 /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | while read -r count ip; do
  if [ "$count" -gt "$THRESHOLD" ]; then
    echo "[ALERT] Potential DoS from $ip: $count requests"
    iptables -A INPUT -s "$ip" -j DROP
  fi
done'''
        },
    ],
    'html_css': [
        {
            'id': 'web-navbar',
            'title': 'Responsive Flexbox Header',
            'filename': 'navbar.html',
            'lang': 'html_css',
            'difficulty': 'Beginner',
            'icon': 'html_css',
            'description': 'Clean semantic HTML header with modern navigation links.',
            'code': '''<header class="navbar">
  <div class="nav-brand">
    <img src="logo.svg" alt="App Logo" class="brand-img" />
    <span class="brand-title">TopicTyper</span>
  </div>
  <nav class="nav-links">
    <a href="/arena" class="nav-item active">Practice</a>
    <a href="/stats" class="nav-item">Analytics</a>
  </nav>
</header>'''
        },
        {
            'id': 'web-grid-cards',
            'title': 'Responsive CSS Grid Cards',
            'filename': 'card_grid.css',
            'lang': 'html_css',
            'difficulty': 'Beginner',
            'icon': 'html_css',
            'description': 'Auto-fit CSS grid layout with subtle hover elevation transitions.',
            'code': '''.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  padding: 2rem;
}
.card {
  border-radius: 12px;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card:hover {
  transform: translateY(-4px);
}'''
        },
        {
            'id': 'web-theme-toggle',
            'title': 'Modern Animated Toggle Switch',
            'filename': 'toggle_switch.html',
            'lang': 'html_css',
            'difficulty': 'Intermediate',
            'icon': 'html_css',
            'description': 'Accessible toggle switch component with smooth CSS transitions.',
            'code': '''<label class="theme-switch" aria-label="Toggle dark mode">
  <input type="checkbox" id="theme-toggle" class="switch-checkbox" />
  <span class="slider round">
    <span class="icon sun">&#9728;</span>
    <span class="icon moon">&#9790;</span>
  </span>
</label>
<style>
  .theme-switch { position: relative; width: 60px; height: 32px; }
  .slider { position: absolute; inset: 0; background: #334155; border-radius: 34px; }
</style>'''
        },
        {
            'id': 'web-modal-dialog',
            'title': 'Glassmorphic Modal Dialog',
            'filename': 'modal_backdrop.css',
            'lang': 'html_css',
            'difficulty': 'Intermediate',
            'icon': 'html_css',
            'description': 'Modern dialog overlay with backdrop blur and depth drop-shadows.',
            'code': '''.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  z-index: 1000;
}
.modal-dialog {
  max-width: 520px;
  width: 90%;
  border-radius: 16px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
}'''
        },
        {
            'id': 'web-shimmer-loader',
            'title': 'Skeleton Shimmer Loading Card',
            'filename': 'skeleton_shimmer.css',
            'lang': 'html_css',
            'difficulty': 'DSA & Algorithms',
            'icon': 'html_css',
            'description': 'Hardware-accelerated CSS gradient keyframe shimmer animation.',
            'code': '''.skeleton-box {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.05) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.8s infinite;
  border-radius: 6px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}'''
        },
        {
            'id': 'web-accordion',
            'title': 'Accessible Details Accordion',
            'filename': 'accordion.html',
            'lang': 'html_css',
            'difficulty': 'DSA & Algorithms',
            'icon': 'html_css',
            'description': 'Pure semantic HTML details and summary interactive accordion.',
            'code': '''<details class="accordion-item">
  <summary class="accordion-header">
    <span>Data Structures & Algorithms</span>
    <span class="chevron">&#9662;</span>
  </summary>
  <div class="accordion-content">
    <p>Practice tree traversals, dynamic programming, and binary search.</p>
  </div>
</details>'''
        },
    ]
}

# Specialized Drills for Requirement 4
SPECIALIZED_DRILLS = [
    {
        'id': 'symbols-gauntlet',
        'title': 'Symbols & Brackets Gauntlet',
        'category': 'Drill',
        'tag': 'Developer Syntax',
        'icon': 'bolt',
        'difficulty': 'Pro',
        'description': 'Heavy practice on {} [] () <> => != && || ; : for programmers.',
        'text': 'if (key >= 0 && arr[i] != null) { return { id: items[key], valid: (x > 0 || y < 10) }; } const fn = (a, b) => (a <= b ? [a, b] : [b, a]); if (status === 200 && (user.role === "admin" || user.id === 1)) { config[type] = { active: true, flags: [1, 2, 4] }; }',
    },
    {
        'id': 'linux-git-cli',
        'title': 'Linux & Git Command Line',
        'category': 'Drill',
        'tag': 'Terminal Mastery',
        'icon': 'terminal',
        'difficulty': 'Intermediate',
        'description': 'Real terminal commands: git, grep, awk, docker, chmod, and ssh.',
        'text': 'git checkout -b feature/auth-upgrade && git commit -m "feat: user profile engine" && git push origin HEAD. docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=secret postgres:16. grep -rn "TODO" src/ | awk -F: \'{print $1, $2}\' | sort | uniq -c. chmod 755 deploy.sh && ssh -i ~/.ssh/id_rsa user@192.168.1.100 "systemctl restart nginx".',
    },
    {
        'id': 'numbers-data-sprint',
        'title': 'Numbers & Data Sprint',
        'category': 'Drill',
        'tag': 'Precision Alphanumeric',
        'icon': 'hash',
        'difficulty': 'Beginner',
        'description': 'Alphanumeric codes, IP addresses, dates, and financial figures.',
        'text': 'Invoice #98214: billed $14,750.80 on 2026-11-13 via wire transfer. Server node-04 IP: 192.168.10.45 port: 8443 latency: 12.4ms packet loss: 0.02%. Order ID: 489-320-8199 quantity: 1,250 unit price: $42.50 discount: 15% subtotal: $45,156.25.',
    },
]

def get_all_snippets():
    """Returns a flat list of all snippets with their language key."""
    items = []
    for lang, snippets in CODE_SNIPPETS.items():
        items.extend(snippets)
    return items

def get_snippets_by_language(lang):
    """Returns snippets for a given language code or python by default."""
    return CODE_SNIPPETS.get(lang.lower(), CODE_SNIPPETS['python'])
