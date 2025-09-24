import sys
from collections import Counter

def contains_permutation(s1, s2):
    m = len(s1)
    n = len(s2)
    if m == 0:
        return True
    if m > n:
        return False

    target = Counter(s1)
    window = Counter(s2[:m])

    if window == target:
        return True

    for i in range(m, n):
        left_char = s2[i - m]
        window[left_char] -= 1
        if window[left_char] == 0:
            del window[left_char]
        right_char = s2[i]
        window[right_char] += 1
        if window == target:
            return True

    return False

def main():
    s1 = 'ab'
    s2 = 'bddwasabsw'
    result = contains_permutation(s1, s2)
    print(result)

if __name__ == "__main__":
    main()