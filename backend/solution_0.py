import sys
from collections import Counter

def contains_permutation(s1, s2):
    m = len(s1)
    n = len(s2)
    if m == 0:
        return True
    if m > n:
        return False
    pat = Counter(s1)
    window = Counter(s2[:m])
    if window == pat:
        return True
    for i in range(m, n):
        left = s2[i - m]
        window[left] -= 1
        if window[left] == 0:
            del window[left]
        right = s2[i]
        window[right] += 1
        if window == pat:
            return True
    return False

def main():
    s1 = 'abi'
    s2 = 'bddwasabsw'
    result = contains_permutation(s1, s2)
    print(result)

if __name__ == "__main__":
    main()